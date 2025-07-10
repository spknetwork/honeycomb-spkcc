import { store, Config } from "../index.mjs"

import { Base64, NFT, DEX } from "../helpers.js"
import { getPathObj, getPathNum } from "../getPathObj.js"
import {
  add,
  chronAssign,
  hashThis,
  isEmpty,
  addMT,
} from "../lil_ops.js"
import { postToDiscord } from "../discord.js"
import stringify from "json-stable-stringify"

// ===== LP Helper Functions =====

/**
 * Calculate and update MSHeld.VALUE based on current holdings and prices
 * @param {object} stats - Stats object containing MSHeld and priceFeed
 * @returns {number} The calculated value in millidollars
 */
const updateMSHeldValue = (stats) => {
  if (!stats.MSHeld) stats.MSHeld = { HIVE: 0, HBD: 0, VALUE: 0 };
  if (!stats.priceFeed) stats.priceFeed = { hivePrice: "0.2170", hivePerHbd: "4.6080" };
  
  // Calculate value in millidollars
  // HBD is pegged to $1 USD, so 1 HBD = 1000 millidollars
  // HIVE value = HIVE amount * HIVE price in USD
  const hbdValue = stats.MSHeld.HBD || 0; // Already in millihbd = millidollars
  const hiveValue = (stats.MSHeld.HIVE || 0) * parseFloat(stats.priceFeed.hivePrice || 0.217);
  
  // Total value in millidollars (integer)
  stats.MSHeld.VALUE = Math.floor(hbdValue + hiveValue);
  
  return stats.MSHeld.VALUE;
};

/**
 * Calculate bonding curve price based on supply and collateral
 * @param {number} currentSupply - Current token supply in pool
 * @param {number} maxSupply - Maximum supply (1/2 of safetyLimit)
 * @param {number} reserveAmount - Current reserve (HIVE/HBD) in pool
 * @param {object} stats - Stats object with pricing info
 * @returns {string} Price per token
 */
const calculateBondingCurvePrice = (currentSupply, maxSupply, reserveAmount, stats) => {
  // Quadratic bonding curve: price = base_price * (1 + (currentSupply / maxSupply)^2)
  const basePrice = parseFloat(stats.icoPrice || 100) / 1000; // Convert from millihive to HIVE
  const supplyRatio = currentSupply / maxSupply;
  const curveMultiplier = 1 + Math.pow(supplyRatio, 2);
  const price = basePrice * curveMultiplier;
  
  // If we have reserves, also consider the constant product price
  if (reserveAmount > 0 && currentSupply > 0) {
    const ammPrice = reserveAmount / currentSupply;
    // Weighted average: 70% bonding curve, 30% AMM price initially
    // As liquidity grows, shift more weight to AMM price
    const ammWeight = Math.min(0.7, reserveAmount / (maxSupply * basePrice));
    const bondingWeight = 1 - ammWeight;
    return ((price * bondingWeight) + (ammPrice * ammWeight)).toFixed(6);
  }
  
  return price.toFixed(6);
};

/**
 * Calculate collateral health score for a provider
 * @param {object} provider - Provider object with signature and consensus data
 * @param {object} stats - Stats object with pendingblock
 * @returns {number} Health score
 */
const calculateCollateralHealth = (provider, stats) => {
  let score = 0;
  
  // Points for credited consensus reports
  if (provider.consensusReportsasBackup > 0) {
    score += provider.CCR
  }
  
  // Points for verified & timely multisig signatures
  if (provider.vS > 0) {
    score += provider.vS;
  }
  
  // Decay factor for inactive providers
  const blocksDelenquint = stats.pendingblock -  provider.lastGood > 100 ? 
  (stats.pendingblock -  provider.lastActivity) / 100 : 1
  const decayFactor = Math.pow(0.95, Math.pow(blocksDelenquint, 0.65));
  
  return (score * decayFactor).toFixed(2);
};

/**
 * Seed initial liquidity in the LP pool using bonding curve
 * @param {object} pairDex - DEX object for a pair (hive or hbd)
 * @param {number} tokenAmount - Amount of tokens to add
 * @param {number} pairAmount - Amount of HIVE/HBD to add
 * @param {string} pair - "hive" or "hbd"
 * @param {object} stats - Stats object with safetyLimit and collateral info
 * @returns {object} DEX object with initialized pool
 */
const seedLpPool = (pairDex, tokenAmount, pairAmount, pair, stats) => {
  pairDex = initializeLpPool(pairDex);
  
  // Calculate maximum available tokens (1/2 of safety limit)
  const maxTokenSupply = Math.floor(stats.safetyLimit / 2);
  
  // If no initial amounts provided, use bonding curve for price discovery
  if (tokenAmount === 0 && pairAmount === 0) {
    // Start with minimal liquidity for price discovery
    dex.pool.token = 0;
    dex.pool.base = 0;
    dex.pool.maxSupply = maxTokenSupply;
    dex.pool.tick = calculateBondingCurvePrice(0, maxTokenSupply, 0, stats);
  } else {
    // Use provided amounts
    dex.pool.token = tokenAmount;
    dex.pool.base = pairAmount;
    dex.pool.maxSupply = maxTokenSupply;
    
    // Set tick based on bonding curve with current liquidity
    dex.pool.tick = calculateBondingCurvePrice(tokenAmount, maxTokenSupply, pairAmount, stats);
  }
  
  return dex;
};

/**
 * Distribute tokens to collateral providers based on multisig weights
 * @param {number} tokensToDistribute - Amount of tokens to distribute
 * @param {object} stats - Stats object with ms data and collateralWeights
 * @param {object} nodes - Node data with collateral amounts
 * @returns {object} Distribution results
 */
const distributeToCollateralProviders = (tokensToDistribute, stats, nodes) => {
  const distribution = {};
  
  // Use the weighted authorities from multisig
  if (!stats.ms || !stats.ms.active_account_auths) {
    return distribution;
  }
  
  // Get total weight from multisig configuration
  let totalWeight = 0;
  const weights = [];
  
  for (const [node, weight] of Object.entries(stats.ms.active_account_auths)) {
    if (nodes[node] && weight > 0) {
      totalWeight += weight;
      weights.push([node, weight]);
    }
  }
  
  // Distribute tokens proportionally to weights
  if (totalWeight > 0) {
    let distributed = 0;
    
    for (const [node, weight] of weights) {
      const tokens = Math.floor((weight / totalWeight) * tokensToDistribute);
      distribution[node] = tokens;
      distributed += tokens;
    }
    
    // Handle rounding remainder - give to lowest weight to improve collateral quality
    const remainder = tokensToDistribute - distributed;
    if (remainder > 0 && weights.length > 0) {
      // Sort by weight ascending and give remainder to lowest weight nodes
      weights.sort((a, b) => a[1] - b[1]);
      let remainderLeft = remainder;
      for (const [node, weight] of weights) {
        if (remainderLeft > 0) {
          distribution[node]++;
          remainderLeft--;
        }
      }
    }
  }
  
  return distribution;
};

/**
 * Add reserve tokens to pool using bonding curve
 * @param {object} dex - DEX object
 * @param {number} reserveAmount - Amount of HIVE/HBD to add
 * @param {string} pair - "hive" or "hbd"
 * @param {object} stats - Stats object
 * @param {object} collateralProviders - Current collateral providers
 * @returns {object} Result with tokens minted and distribution
 */
const addReserveToBondingCurve = (dex, reserveAmount, pair, stats, collateralProviders) => {
  const currentSupply = dex.pool.token || 0;
  const maxSupply = dex.pool.maxSupply || Math.floor(stats.safetyLimit / 2);
  const currentReserve = dex.pool[pair] || 0;
  
  // Calculate tokens to mint based on bonding curve
  const currentPrice = parseFloat(dex.tick || calculateBondingCurvePrice(currentSupply, maxSupply, currentReserve, stats));
  const tokensToMint = Math.floor(reserveAmount / currentPrice);
  
  // Check if we're within supply limits
  if (currentSupply + tokensToMint > maxSupply) {
    const availableTokens = maxSupply - currentSupply;
    const adjustedReserve = Math.floor(availableTokens * currentPrice);
    
    return {
      success: false,
      error: 'Exceeds maximum supply',
      maxTokens: availableTokens,
      maxReserve: adjustedReserve
    };
  }
  
  // Calculate distribution: 1/3 to pool, 2/3 to providers (maintaining 2:1 collateral ratio)
  const poolShare = Math.floor(tokensToMint / 3);
  const providerShare = tokensToMint - poolShare;
  
  // Check if adding to pool would exceed safety limits
  const newPoolTokens = (dex.pool.token || 0) + poolShare;
  if (newPoolTokens > maxSupply) {
    // Adjust to stay within limits
    const availablePoolSpace = maxSupply - (dex.pool.token || 0);
    const adjustedPoolShare = Math.max(0, availablePoolSpace);
    const adjustedProviderShare = adjustedPoolShare * 2; // Maintain 2:1 ratio
    const adjustedTotal = adjustedPoolShare + adjustedProviderShare;
    
    return {
      success: false,
      error: 'Would exceed collateral limits',
      maxTokens: adjustedTotal,
      poolShare: adjustedPoolShare,
      providerShare: adjustedProviderShare
    };
  }
  
  // Add to pool
  dex.pool.token += poolShare;
  dex.pool[pair] += reserveAmount;
  
  // Update price based on new pool state
  dex.tick = calculateBondingCurvePrice(dex.pool.token, maxSupply, dex.pool[pair], stats);
  
  // Get nodes data for distribution
  const nodes = collateralProviders || {};
  const distribution = distributeToCollateralProviders(providerShare, stats, nodes);
  
  return {
    success: true,
    tokensMinted: tokensToMint,
    tokensToPool: poolShare,
    tokensToProviders: providerShare,
    newPrice: dex.tick,
    distribution
  };
};

/**
 * Calculate the curve price (P_curve) for a liquidity pool
 * @param {number} tokenReserve - Amount of tokens in the pool
 * @param {number} pairReserve - Amount of HIVE/HBD in the pool
 * @returns {string} Price as a string with 6 decimal places
 */
const calculateCurvePrice = (tokenReserve, pairReserve) => {
  if (!tokenReserve || !pairReserve) return "0.000000";
  return (pairReserve / tokenReserve).toFixed(6);
};

/**
 * Execute first sale using bonding curve when no liquidity exists
 * @param {object} dex - DEX object
 * @param {number} pairAmount - Amount of HIVE/HBD to spend
 * @param {string} pair - "hive" or "hbd"
 * @param {object} stats - Stats object
 * @param {string} buyer - Buyer account
 * @returns {object} Purchase result
 */
const executeFirstSale = (dex, pairAmount, pair, stats, buyer) => {
  // Initialize pool if needed
  if (!dex.pool || (!dex.pool.maxSupply && dex.pool.token === 0)) {
    seedLpPool(dex, 0, 0, pair, stats);
  }
  
  const maxSupply = dex.pool.maxSupply || Math.floor(stats.safetyLimit / 2);
  let totalCost = 0;
  let tokensBought = 0;
  let currentSupply = dex.pool.token || 0;
  
  // Calculate tokens that can be bought using integral of bonding curve
  // For quadratic curve: ∫price dx = base_price * (x + x³/3*maxSupply²)
  const basePrice = parseFloat(stats.icoPrice || 100) / 1000;
  
  // Binary search to find how many tokens can be bought with pairAmount
  let low = 0;
  let high = Math.min(pairAmount / basePrice, maxSupply - currentSupply);
  
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const cost = calculateBondingCurveCost(currentSupply, currentSupply + mid, maxSupply, basePrice);
    
    if (cost <= pairAmount) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  tokensBought = low;
  totalCost = calculateBondingCurveCost(currentSupply, currentSupply + tokensBought, maxSupply, basePrice);
  
  // Update pool
  dex.pool.token += tokensBought;
  dex.pool[pair] += totalCost;
  
  // Update tick to reflect new price
  dex.tick = calculateBondingCurvePrice(dex.pool.token, maxSupply, dex.pool[pair], stats);
  
  // Track the purchase
  if (!dex.pool.purchases) {
    dex.pool.purchases = [];
  }
  dex.pool.purchases.push({
    buyer,
    tokens: tokensBought,
    cost: totalCost,
    price: (totalCost / tokensBought).toFixed(6),
    block: Date.now() // Should use block number
  });
  
  return {
    success: true,
    tokensBought,
    totalCost,
    avgPrice: (totalCost / tokensBought).toFixed(6),
    newTick: dex.tick,
    refund: pairAmount - totalCost
  };
};

/**
 * Calculate cost to buy tokens using bonding curve integral
 * @param {number} from - Starting supply
 * @param {number} to - Ending supply
 * @param {number} maxSupply - Maximum supply
 * @param {number} basePrice - Base price
 * @returns {number} Total cost
 */
const calculateBondingCurveCost = (from, to, maxSupply, basePrice) => {
  // Integral of quadratic bonding curve
  const amount = to - from;
  const fromRatio = from / maxSupply;
  const toRatio = to / maxSupply;
  
  // ∫base_price * (1 + x²) dx = base_price * (x + x³/3)
  const fromCost = basePrice * (from + Math.pow(fromRatio, 3) * maxSupply / 3);
  const toCost = basePrice * (to + Math.pow(toRatio, 3) * maxSupply / 3);
  
  return toCost - fromCost;
};

/**
 * Calculate output amount for a constant product AMM swap
 * @param {number} amountIn - Input amount
 * @param {number} reserveIn - Reserve of input asset
 * @param {number} reserveOut - Reserve of output asset
 * @param {number} fee - Fee percentage (e.g., 0.005 for 0.5%)
 * @returns {number} Output amount
 */
const calculateSwapOutput = (amountIn, reserveIn, reserveOut, fee = 0.005) => {
  if (!reserveIn || !reserveOut || !amountIn) return 0;
  const amountInWithFee = amountIn * (1 - fee);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  return Math.floor(numerator / denominator);
};

/**
 * Check if an operation would exceed the collateral safety limit
 * @param {number} additionalHive - Additional HIVE value to add
 * @param {number} additionalHbd - Additional HBD value to add
 * @param {object} stats - Stats object containing safetyLimit and priceFeed
 * @param {object} dex - DEX object containing current LP balances
 * @returns {boolean} True if operation is within limits, false otherwise
 */
const checkCollateralLimit = (additionalHive, additionalHbd, stats, dex) => {
  // Convert HBD to HIVE equivalent using price feed
  const hbdToHive = additionalHbd * parseFloat(stats.priceFeed?.hivePerHbd || 1);
  
  // Calculate total additional value in HIVE
  const totalAdditionalHive = additionalHive + hbdToHive;
  
  // Get current LP holdings
  const currentLpHive = (dex.hive?.pool?.hive || 0) + (dex.hbd?.pool?.hbd || 0) * parseFloat(stats.priceFeed?.hivePerHbd || 1);
  
  // Get current open buy orders value
  let openOrdersValue = 0;
  if (dex.hive?.buyOrders) {
    for (const order of Object.values(dex.hive.buyOrders)) {
      openOrdersValue += order.hive || 0;
    }
  }
  if (dex.hbd?.buyOrders) {
    for (const order of Object.values(dex.hbd.buyOrders)) {
      openOrdersValue += (order.hbd || 0) * parseFloat(stats.priceFeed?.hivePerHbd || 1);
    }
  }
  
  // Check if total would exceed safety limit
  const totalValue = currentLpHive + openOrdersValue + totalAdditionalHive;
  const safetyLimit = stats.safetyLimit || 0;
  
  return totalValue <= safetyLimit;
};

/**
 * Initialize LP pool structure if not exists
 * @param {object} dex - DEX object for a pair (hive or hbd)
 * @returns {object} DEX object with initialized pool
 */
const initializeLpPool = (dex) => {
  if (!dex.pool) {
    dex.pool = {
      token: 0,
      base: 0
    };
  }
  return dex;
};

/**
 * Execute LP swap and update reserves
 * @param {number} amountIn - Input amount
 * @param {string} inputType - "token", "hive", or "hbd"
 * @param {object} dex - DEX object for the pair
 * @param {object} stats - Stats object
 * @returns {object} {success: boolean, amountOut: number, newTick: string}
 */
const executeLpSwap = (amountIn, inputType, dex, stats, buyer = null) => {
  initializeLpPool(dex);
  
  // Determine the pair type based on dex object structure
  let pair = "";
  if (dex.buyBook !== undefined || dex.sellBook !== undefined) {
    // Check if this is hive or hbd dex by looking at existing orders
    if (dex.buyOrders) {
      const firstOrder = Object.values(dex.buyOrders)[0];
      if (firstOrder && firstOrder.hive !== undefined) pair = "hive";
      else if (firstOrder && firstOrder.hbd !== undefined) pair = "hbd";
    }
    if (!pair && dex.sellOrders) {
      const firstOrder = Object.values(dex.sellOrders)[0];
      if (firstOrder && firstOrder.hive !== undefined) pair = "hive";
      else if (firstOrder && firstOrder.hbd !== undefined) pair = "hbd";
    }
  }
  if (!pair) return {success: false, amountOut: 0, newTick: dex.tick};
  
  // Check if pool has no liquidity and we're buying tokens
  if ((!dex.pool.token || dex.pool.token === 0) && (!dex.pool[pair] || dex.pool[pair] === 0) && inputType !== "token") {
    // Use bonding curve for first sale
    const result = executeFirstSale(dex, amountIn, pair, stats, buyer || "unknown");
    if (result.success) {
      return {
        success: true,
        amountOut: result.tokensBought,
        newTick: result.newTick,
        avgPrice: result.avgPrice,
        refund: result.refund
      };
    }
    return {success: false, amountOut: 0, newTick: dex.tick};
  }
  
  // If we have a bonding curve in effect but also some liquidity, use hybrid approach
  if (dex.pool.maxSupply && dex.pool.token < dex.pool.maxSupply * 0.1) {
    // Less than 10% of max supply - still use bonding curve heavily
    const bondingWeight = 0.7;
    const ammWeight = 0.3;
    
    if (inputType !== "token") {
      // Buying tokens - calculate both bonding curve and AMM prices
      const bondingResult = executeFirstSale(dex, amountIn * bondingWeight, pair, stats, buyer || "unknown");
      
      // Calculate AMM output for remaining amount
      const fee = parseFloat(stats.dex_fee) || 0.005;
      const ammInput = amountIn * ammWeight;
      const ammOutput = dex.pool.token > 0 ? 
        calculateSwapOutput(ammInput, dex.pool[pair], dex.pool.token, fee) : 0;
      
      if (bondingResult.success && ammOutput > 0) {
        dex.pool[pair] += ammInput;
        dex.pool.token -= ammOutput;
        
        const totalOutput = bondingResult.tokensBought + ammOutput;
        const avgPrice = amountIn / totalOutput;
        
        return {
          success: true,
          amountOut: totalOutput,
          newTick: calculateBondingCurvePrice(dex.pool.token, dex.pool.maxSupply, dex.pool[pair], stats),
          avgPrice: avgPrice.toFixed(6)
        };
      }
    }
  }
  
  // Standard AMM swap logic
  const fee = parseFloat(stats.dex_fee) || 0.005;
  let amountOut = 0;
  let newTick = dex.tick;
  
  if (inputType === "token") {
    // Selling tokens for HIVE/HBD
    const tokenReserve = dex.pool.token;
    const pairReserve = dex.pool[pair];
    
    if (!tokenReserve || !pairReserve) return {success: false, amountOut: 0, newTick};
    
    amountOut = calculateSwapOutput(amountIn, tokenReserve, pairReserve, fee);
    
    if (amountOut > 0 && amountOut < pairReserve) {
      // Update reserves
      dex.pool.token += amountIn;
      dex.pool[pair] -= amountOut;
      
      // Calculate new price after swap
      if (dex.pool.maxSupply) {
        newTick = calculateBondingCurvePrice(dex.pool.token, dex.pool.maxSupply, dex.pool[pair], stats);
      } else {
        newTick = calculateCurvePrice(dex.pool.token, dex.pool[pair]);
      }
      
      return {success: true, amountOut, newTick};
    }
  } else {
    // Buying tokens with HIVE/HBD
    const pairReserve = dex.pool[pair];
    const tokenReserve = dex.pool.token;
    
    if (!tokenReserve || !pairReserve) return {success: false, amountOut: 0, newTick};
    
    amountOut = calculateSwapOutput(amountIn, pairReserve, tokenReserve, fee);
    
    if (amountOut > 0 && amountOut < tokenReserve) {
      // Update reserves
      dex.pool[pair] += amountIn;
      dex.pool.token -= amountOut;
      
      // Calculate new price after swap
      if (dex.pool.maxSupply) {
        newTick = calculateBondingCurvePrice(dex.pool.token, dex.pool.maxSupply, dex.pool[pair], stats);
      } else {
        newTick = calculateCurvePrice(dex.pool.token, dex.pool[pair]);
      }
      
      return {success: true, amountOut, newTick};
    }
  }
  
  return {success: false, amountOut: 0, newTick};
};

/**
 * Calculate optimal LP balancing targets based on volume EMAs
 * @param {object} stats - Stats object containing volumeEMA
 * @returns {object} Target ratios for each market
 */
const calculateBalancingTargets = (stats) => {
  // Minimum 25% in each market
  const MIN_RATIO = 0.25;
  
  // Get volume ratios, default to 50/50 if not available
  const hiveVolumeRatio = parseFloat(stats.volumeEMA?.hiveRatio || 0.5);
  const hbdVolumeRatio = parseFloat(stats.volumeEMA?.hbdRatio || 0.5);
  
  // Calculate targets: 25% + (volumeRatio / 2)
  // This gives range from 25% (0% volume) to 75% (100% volume)
  const hiveTarget = MIN_RATIO + (hiveVolumeRatio / 2);
  const hbdTarget = MIN_RATIO + (hbdVolumeRatio / 2);
  
  return {
    hive: hiveTarget,
    hbd: hbdTarget,
    hivePercent: (hiveTarget * 100).toFixed(1),
    hbdPercent: (hbdTarget * 100).toFixed(1)
  };
};

/**
 * Execute LP balancing between HIVE and HBD pools
 * @param {object} dexHive - HIVE DEX object
 * @param {object} dexHbd - HBD DEX object
 * @param {object} stats - Stats object with volumeEMA and priceFeed
 * @returns {object} Balancing results and operations
 */
export const balanceLiquidityPools = (dexHive, dexHbd, stats) => {
  // Initialize pools if needed
  dexHive = initializeLpPool(dexHive);
  dexHbd = initializeLpPool(dexHbd);
  
  // Get current pool values in HBD terms
  const hivePerHbd = parseFloat(stats.priceFeed?.hivePerHbd || 4.608);
  const hiveTickPrice = parseFloat(dexHive.tick || 0.1);
  const hbdTickPrice = parseFloat(dexHbd.tick || 0.1);
  
  // Calculate current pool values in HBD
  const hivePoolTokenValue = (dexHive.pool.token || 0) * hbdTickPrice;
  const hivePoolHiveValue = (dexHive.pool.hive || 0) / hivePerHbd;
  const hivePoolTotalValue = hivePoolTokenValue + hivePoolHiveValue;
  
  const hbdPoolTokenValue = (dexHbd.pool.token || 0) * hbdTickPrice;
  const hbdPoolHbdValue = (dexHbd.pool.hbd || 0);
  const hbdPoolTotalValue = hbdPoolTokenValue + hbdPoolHbdValue;
  
  const totalValue = hivePoolTotalValue + hbdPoolTotalValue;
  
  if (totalValue === 0) {
    return {
      success: false,
      message: "No liquidity to balance"
    };
  }
  
  // Calculate current ratios
  const currentHiveRatio = hivePoolTotalValue / totalValue;
  const currentHbdRatio = hbdPoolTotalValue / totalValue;
  
  // Get target ratios
  const targets = calculateBalancingTargets(stats);
  
  // Check if rebalancing is needed (> 5% deviation)
  const REBALANCE_THRESHOLD = 0.05;
  const hiveDeviation = Math.abs(currentHiveRatio - targets.hive);
  const hbdDeviation = Math.abs(currentHbdRatio - targets.hbd);
  
  if (hiveDeviation < REBALANCE_THRESHOLD && hbdDeviation < REBALANCE_THRESHOLD) {
    return {
      success: true,
      message: "Pools are balanced",
      currentRatios: {
        hive: (currentHiveRatio * 100).toFixed(1) + "%",
        hbd: (currentHbdRatio * 100).toFixed(1) + "%"
      },
      targetRatios: {
        hive: targets.hivePercent + "%",
        hbd: targets.hbdPercent + "%"
      }
    };
  }
  
  // Calculate rebalancing amounts
  const targetHiveValue = totalValue * targets.hive;
  //const targetHbdValue = totalValue * targets.hbd;
  
  const valueToMove = Math.abs(targetHiveValue - hivePoolTotalValue);
  
  // Determine direction and amounts
  let result = {
    success: true,
    operations: [],
    fromPool: "",
    toPool: "",
    tokenAmount: 0,
    pairAmount: 0
  };
  
  if (currentHiveRatio > targets.hive) {
    // Move from HIVE to HBD pool
    result.fromPool = "hive";
    result.toPool = "hbd";
    
    // Calculate how much to move (in token terms for simplicity)
    const tokenRatio = dexHive.pool.token / (dexHive.pool.token + dexHive.pool.hive / hiveTickPrice);
    result.tokenAmount = Math.floor(valueToMove * tokenRatio / hbdTickPrice);
    result.pairAmount = Math.floor(valueToMove * (1 - tokenRatio));
    
    // Ensure we don't move more than available
    result.tokenAmount = Math.min(result.tokenAmount, Math.floor(dexHive.pool.token * 0.5));
    result.pairAmount = Math.min(result.pairAmount, Math.floor(dexHive.pool.hive * 0.5 / hivePerHbd));
    
  } else {
    // Move from HBD to HIVE pool
    result.fromPool = "hbd";
    result.toPool = "hive";
    
    // Calculate how much to move
    const tokenRatio = dexHbd.pool.token / (dexHbd.pool.token + dexHbd.pool.hbd / hbdTickPrice);
    result.tokenAmount = Math.floor(valueToMove * tokenRatio / hbdTickPrice);
    result.pairAmount = Math.floor(valueToMove * (1 - tokenRatio) * hivePerHbd);
    
    // Ensure we don't move more than available
    result.tokenAmount = Math.min(result.tokenAmount, Math.floor(dexHbd.pool.token * 0.5));
    result.pairAmount = Math.min(result.pairAmount, Math.floor(dexHbd.pool.hbd * 0.5));
  }
  
  result.message = `Rebalancing ${result.tokenAmount} tokens and ${result.pairAmount} ${result.toPool.toUpperCase()} from ${result.fromPool.toUpperCase()} to ${result.toPool.toUpperCase()} pool`;
  result.currentRatios = {
    hive: (currentHiveRatio * 100).toFixed(1) + "%",
    hbd: (currentHbdRatio * 100).toFixed(1) + "%"
  };
  result.targetRatios = {
    hive: targets.hivePercent + "%",
    hbd: targets.hbdPercent + "%"
  };
  
  // The actual pool updates would be done by the calling function
  // This function just calculates what needs to be done
  
  return result;
};

/**
 * Add liquidity to the LP pool
 * @param {object} dex - DEX object for a pair
 * @param {number} tokenAmount - Amount of tokens to add
 * @param {number} pairAmount - Amount of HIVE/HBD to add
 * @param {string} pair - "hive" or "hbd"
 * @param {object} stats - Stats object
 * @returns {object} {success: boolean, lpTokens: number}
 */
export const addLiquidity = (dex, tokenAmount, pairAmount, pair, stats) => {
  initializeLpPool(dex);
  
  // If pool is empty and no amounts provided, this is a bonding curve scenario
  if (dex.pool.token === 0 && dex.pool[pair] === 0 && tokenAmount === 0 && pairAmount === 0) {
    // Initialize with bonding curve
    seedLpPool(dex, 0, 0, pair, stats);
    return {
      success: true, 
      lpTokens: 0, 
      message: "Pool initialized with bonding curve",
      tick: dex.tick
    };
  }
  
  // If pool is empty but amounts provided, seed it
  if (dex.pool.token === 0 || dex.pool[pair] === 0) {
    seedLpPool(dex, tokenAmount, pairAmount, pair, stats);
    // For initial liquidity, LP tokens = sqrt(tokenAmount * pairAmount)
    const lpTokens = Math.floor(Math.sqrt(tokenAmount * pairAmount));
    return {success: true, lpTokens};
  }
  
  // If we have a bonding curve in effect (maxSupply set), use that mechanism
  if (dex.pool.maxSupply && pairAmount > 0 && tokenAmount === 0) {
    // This is adding reserves to the bonding curve
    const collateralProviders = dex.pool.collateralProviders || {};
    const result = addReserveToBondingCurve(dex, pairAmount, pair, stats, collateralProviders);
    
    if (result.success) {
      return {
        success: true,
        lpTokens: result.tokensToPool, // Tokens added to pool liquidity
        tokensMinted: result.tokensMinted,
        distribution: result.distribution,
        newPrice: result.newPrice
      };
    } else {
      return {
        success: false,
        lpTokens: 0,
        error: result.error,
        maxAvailable: result.maxTokens
      };
    }
  }
  
  // Standard liquidity provision (both token and pair amounts)
  const currentRatio = dex.pool[pair] / dex.pool.token;
  const providedRatio = pairAmount / tokenAmount;
  
  // Require balanced liquidity provision (within 1% tolerance)
  if (Math.abs(currentRatio - providedRatio) / currentRatio > 0.01) {
    return {success: false, lpTokens: 0, error: "Imbalanced liquidity"};
  }
  
  // Calculate LP tokens based on share of pool
  const shareOfPool = tokenAmount / dex.pool.token;
  const totalLpTokens = dex.pool.lpTokens || Math.floor(Math.sqrt(dex.pool.token * dex.pool[pair]));
  const lpTokens = Math.floor(totalLpTokens * shareOfPool);
  
  // Update pool reserves
  dex.pool.token += tokenAmount;
  dex.pool[pair] += pairAmount;
  dex.pool.lpTokens = totalLpTokens + lpTokens;
  
  // Update tick based on new reserves
  if (dex.pool.maxSupply) {
    // Use bonding curve if in effect
    dex.tick = calculateBondingCurvePrice(dex.pool.token, dex.pool.maxSupply, dex.pool[pair], stats);
  } else {
    // Use standard AMM price
    dex.tick = calculateCurvePrice(dex.pool.token, dex.pool[pair]);
  }
  
  return {success: true, lpTokens};
};

/**
 * Process LP management operations
 * @param {object} json - JSON operation data
 * @param {string} from - Account performing operation
 * @param {boolean} active - If active authority
 * @param {array} pc - Promise chain
 */
export const dex_lp_action = (options = {action: "balance_pools"}) => {
  return new Promise( async (resolve, reject) => {
  if (options.action === "balance_pools") {
    const [ stats, dexHive, dexHbd ] = await Promise.all([getPathObj(["stats"]), getPathObj(["dex", "hive"]), getPathObj(["dex", "hbd"])])
      // Execute balancing
      const result = balanceLiquidityPools(dexHive, dexHbd, stats);
      
      if (result.success && result.tokenAmount > 0) {
        // Apply the rebalancing
        if (result.fromPool === "hive") {
          dexHive.pool.token -= result.tokenAmount;
          dexHive.pool.hive -= result.pairAmount * parseFloat(stats.priceFeed?.hivePerHbd || 4.608);
          dexHbd.pool.token += result.tokenAmount;
          dexHbd.pool.hbd += result.pairAmount;
        } else {
          dexHbd.pool.token -= result.tokenAmount;
          dexHbd.pool.hbd -= result.pairAmount;
          dexHive.pool.token += result.tokenAmount;
          dexHive.pool.hive += result.pairAmount;
        }
        
        // Update ticks based on new ratios
        dexHive.tick = calculateCurvePrice(dexHive.pool.token, dexHive.pool.hive);
        dexHbd.tick = calculateCurvePrice(dexHbd.pool.token, dexHbd.pool.hbd);
        
        const ops = [
          { type: "put", path: ["dex", "hive"], data: dexHive },
          { type: "put", path: ["dex", "hbd"], data: dexHbd },
        ];
        
        resolve(ops);
      } else {
        resolve([]);
      }
  } else {
    resolve([]);
  }
  });
};

export const dex_sell = (json, from, active, pc) => {
  let PfromBal = getPathNum(["balances", from]),
    PStats = getPathObj(["stats"]),
    PSB = getPathObj(["dex", "hive"]),
    order = {};
  if (parseInt(json.hive)) {
    order.type = "LIMIT";
    order.target = parseInt(json.hive);
    order.rate = parseFloat(
      parseInt(json.hive) / parseInt(json[Config("jsonTokenName")])
    ).toFixed(6);
    order.pair = "hive";
  } else if (parseInt(json.hbd)) {
    PSB = getPathObj(["dex", "hbd"]);
    order.type = "LIMIT";
    order.pair = "hbd";
    order.target = parseInt(json.hbd);
    order.rate = parseFloat(
      parseInt(json.hbd) / parseInt(json[Config("jsonTokenName")])
    ).toFixed(6);
  } else if (json.pair == "HBD") {
    PSB = getPathObj(["dex", "hbd"]);
    order.type = "MARKET";
    order.pair = "hbd";
  } else {
    order = {
      type: "MARKET",
      pair: "hive",
      amount: json[Config("jsonTokenName")],
    };
  }
  if (parseFloat(order.rate) < 0) {
    (order.type = "MARKET"), delete order.rate;
  }
  order[Config("jsonTokenName")] = parseInt(json[Config("jsonTokenName")]);
  Promise.all([PfromBal, PStats, PSB])
    .then((a) => {
      let bal = a[0],
        stats = a[1],
        dex = a[2],
        ops = [],
        adds = [],
        his = {},
        fee = 0,
        hours = parseInt(json.hours) || 720;
      if (hours > 720) {
        hours = 720;
      }
      const expBlock = json.block_num + hours * 1200;
      if (
        order[Config("jsonTokenName")] <= bal &&
        order[Config("jsonTokenName")] >= 4 &&
        active
      ) {
        let remaining = json[Config("jsonTokenName")],
          filled = 0,
          pair = 0,
          i = 0,
          path = 0,
          contract = "";
        sell_loop: while (remaining) {
          // Initialize LP pool if needed
          initializeLpPool(dex);
          
          // Calculate curve price based on LP reserves
          const curvePrice = calculateCurvePrice(dex.pool.token, dex.pool[order.pair]);
          
          let price = dex.buyBook
            ? parseFloat(dex.buyBook.split("_")[0])
            : dex.tick;
          let item = dex.buyBook ? dex.buyBook.split("_")[1].split(",")[0] : "";
          
          // Check if order provides better liquidity than LP
          const orderProvidesBetterLiquidity = item && parseFloat(price) > parseFloat(curvePrice);
          
          //console.log({ json, item, price, order, curvePrice, orderProvidesBetterLiquidity });
          
          if (
            item &&
            (order.type == "MARKET" ||
              parseFloat(price) >= parseFloat(order.rate)) &&
            orderProvidesBetterLiquidity
          ) {
            let next = dex.buyOrders?.[`${price.toFixed(6)}:${item}`];
            if (!next) {
              dex.buyBook = DEX.remove(item, dex.buyBook);
              continue sell_loop;
            }
            if (next.amount <= remaining) {
              if (next[order.pair]) {
                filled += next.amount;
                adds.push([next.from, next.amount - next.fee]);
                his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                  type: "sell",
                  t: Date.parse(json.timestamp + ".000Z"),
                  block: json.block_num,
                  base_vol: next.amount,
                  target_vol: next[order.pair],
                  target: order.pair,
                  price: next.rate,
                  id: json.transaction_id + i,
                };
                fee += next.fee; //add the fees
                remaining -= next.amount;
                dex.tick = price.toFixed(6);
                pair += next[order.pair];
                dex.buyBook = DEX.remove(item, dex.buyBook); //adjust the orderbook
                delete dex.buyOrders[`${price.toFixed(6)}:${item}`];
                const transfer = [
                  "transfer",
                  {
                    from: Config("msaccount"),
                    to: from,
                    amount:
                      parseFloat(next[order.pair] / 1000).toFixed(3) +
                      " " +
                      order.pair.toUpperCase(),
                    memo: `Filled ${item}:${json.transaction_id}`,
                  },
                ];
                let msg = `@${from} sold ${parseFloat(
                  parseInt(next.amount) / 1000
                ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                  parseInt(next[order.pair]) / 1000
                ).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from
                  } (${item})`;
                ops.push({
                  type: "put",
                  path: [
                    "feed",
                    `${json.block_num}:${json.transaction_id}.${i}`,
                  ],
                  data: msg,
                });
                ops.push({
                  type: "put",
                  path: [
                    "msa",
                    `${item}:${json.transaction_id}:${json.block_num}`,
                  ],
                  data: stringify(transfer),
                }); //send HIVE out via MS
                ops.push({
                  type: "del",
                  path: [
                    "dex",
                    order.pair,
                    "buyOrders",
                    `${price.toFixed(6)}:${item}`,
                  ],
                }); //remove the order
                ops.push({ type: "del", path: ["contracts", next.from, item] }); //remove the contract
                ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
              } else {
                fee += next.fee;
                fee += next.amount;
                dex.buyBook = DEX.remove(item, dex.buyBook);
                delete dex.buyOrders[`${price.toFixed(6)}:${item}`];
                ops.push({
                  type: "del",
                  path: [
                    "dex",
                    order.pair,
                    "buyOrders",
                    `${price.toFixed(6)}:${item}`,
                  ],
                }); //remove the order
                ops.push({ type: "del", path: ["contracts", next.from, item] }); //remove the contract
                ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
              }
            } else {
              const thisfee = parseInt((remaining / next.amount) * next.fee);
              const thistarget = parseInt(
                (remaining / next.amount) * next[order.pair]
              );
              if (thistarget) {
                next.fee -= thisfee;
                next[order.pair] -= thistarget;
                next.amount -= remaining;
                filled += remaining;
                pair += thistarget;
                var partial = {
                  coin: thistarget,
                  token: remaining + thisfee,
                };
                if (next.partial) {
                  next.partial[`${json.transaction_id}`] = partial;
                } else {
                  next.partial = {
                    [`${json.transaction_id}`]: partial,
                  };
                }
                adds.push([next.from, remaining - thisfee]);
                dex.tick = price.toFixed(6);
                his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                  type: "sell",
                  t: Date.parse(json.timestamp),
                  block: json.block_num,
                  base_vol: remaining + thisfee,
                  target_vol: thistarget,
                  target: order.pair,
                  price: next.rate,
                  id: json.transaction_id + i,
                };
                fee += thisfee;
                const transfer = [
                  "transfer",
                  {
                    from: Config("msaccount"),
                    to: from,
                    amount:
                      parseFloat(thistarget / 1000).toFixed(3) +
                      " " +
                      order.pair.toUpperCase(),
                    memo: `Partial Filled ${item}:${json.transaction_id}`,
                  },
                ];
                let msg = `@${from} sold ${parseFloat(
                  parseInt(remaining) / 1000
                ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                  parseInt(thistarget) / 1000
                ).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from
                  } (${item})`;
                ops.push({
                  type: "put",
                  path: [
                    "feed",
                    `${json.block_num}:${json.transaction_id}.${i}`,
                  ],
                  data: msg,
                });
                ops.push({
                  type: "put",
                  path: [
                    "msa",
                    `${item}:${json.transaction_id}:${json.block_num}`,
                  ],
                  data: stringify(transfer),
                }); //send HIVE out via MS
                ops.push({
                  type: "put",
                  path: ["contracts", next.from, item],
                  data: next,
                }); //remove the contract
                dex.buyOrders[`${price.toFixed(6)}:${item}`] = next;
                remaining = 0;
              } else {
                fee += remaining;
                remaining = 0;
              }
            }
          } else {
            // Try LP swap if we have reserves and it's allowed by collateral limits
            if (dex.pool && dex.pool.token > 0 && dex.pool[order.pair] > 0 && parseFloat(curvePrice) > 0) {
              // Check collateral limits before LP swap
              const additionalHive = order.pair === "hive" ? 0 : remaining;
              const additionalHbd = order.pair === "hbd" ? 0 : remaining;
              
              if (checkCollateralLimit(additionalHive, additionalHbd, stats, dex)) {
                // Execute LP swap
                const swapResult = executeLpSwap(remaining, "token", dex, stats);
                
                if (swapResult.success && swapResult.amountOut > 0) {
                  // LP swap successful
                  filled += remaining;
                  pair += swapResult.amountOut;
                  dex.tick = swapResult.newTick;
                  
                  // Create transfer for LP swap
                  const transfer = [
                    "transfer",
                    {
                      from: Config("msaccount"),
                      to: from,
                      amount:
                        parseFloat(swapResult.amountOut / 1000).toFixed(3) +
                        " " +
                        order.pair.toUpperCase(),
                      memo: `LP Swap: ${json.transaction_id}`,
                    },
                  ];
                  
                  his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                    type: "sell",
                    t: Date.parse(json.timestamp + ".000Z"),
                    block: json.block_num,
                    base_vol: remaining,
                    target_vol: swapResult.amountOut,
                    target: order.pair,
                    price: swapResult.newTick,
                    id: json.transaction_id + i,
                  };
                  
                  let msg = `@${from} sold ${parseFloat(
                    parseInt(remaining) / 1000
                  ).toFixed(3)} ${Config("TOKEN")} for ${parseFloat(
                    parseInt(swapResult.amountOut) / 1000
                  ).toFixed(3)} ${order.pair.toUpperCase()} via LP swap`;
                  
                  ops.push({
                    type: "put",
                    path: [
                      "feed",
                      `${json.block_num}:${json.transaction_id}.${i}`,
                    ],
                    data: msg,
                  });
                  
                  ops.push({
                    type: "put",
                    path: [
                      "msa",
                      `LP:${json.transaction_id}:${json.block_num}`,
                    ],
                    data: stringify(transfer),
                  });
                  
                  // Calculate and distribute fees
                  const lpFee = parseInt(remaining * (parseFloat(stats.dex_fee) || 0.005));
                  fee += lpFee;
                  
                  remaining = 0;
                  i++;
                  continue sell_loop;
                }
              }
            }
            
            // If LP swap failed or not available, create limit order
            let txid = Config("TOKEN") + hashThis(from + json.transaction_id),
              crate =
                typeof parseFloat(order.rate) == "number"
                  ? parseFloat(order.rate).toFixed(6)
                  : dex.tick,
              cfee =
                parseFloat(stats.dex_fee) > 0
                  ? parseInt(parseInt(remaining) * parseFloat(stats.dex_fee)) +
                  1
                  : parseInt(parseInt(remaining) * 0.005) + 1,
              hours = 720;
            if (crate > 0) {
              contract = {
                txid,
                from: from,
                hive: 0,
                hbd: 0,
                fee: cfee,
                amount: remaining,
                rate: crate,
                block: json.block_num,
                type: `${order.pair}:sell`,
                hive_id: json.transaction_id,
              };
              contract[order.pair] = parseInt(remaining * parseFloat(crate));
              dex.sellBook = DEX.insert(txid, crate, dex.sellBook, "sell");
              path = [
                expBlock,
                {
                  block: expBlock,
                  op: "expire",
                  from,
                  txid,
                },
              ];
              remaining = 0;
            } else {
              bal += remaining;
              remaining = 0;
            }
          }
          i++;
        }
        var addops = {};
        for (var j = 0; j < adds.length; j++) {
          if (addops[adds[j][0]]) {
            addops[adds[j][0]] += adds[j][1];
          } else {
            addops[adds[j][0]] = adds[j][1];
          }
        }
        bal -= json[Config("jsonTokenName")];
        if (addops[from]) {
          bal += addops[from];
          delete addops[from];
        }
        const msg = `@${from}| Sell order confirmed.`;
        if (Config("hookurl") || Config("status"))
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        ops.push({ type: "put", path: ["balances", from], data: bal });
        ops.push({ type: "put", path: ["dex", order.pair], data: dex });
        if (Object.keys(his).length)
          ops.push({
            type: "put",
            path: ["dex", order.pair, "his"],
            data: his,
          });
        add("rn", fee).then((empty) => {
          addop(0, addops);
        });
        function addop(i, a) {
          var keys = Object.keys(a);
          if (i < keys.length) {
            add(keys[i], a[keys[i]]).then((empty) => {
              if (keys.length > i + 1) {
                addop(i + 1, a);
              } else {
                finish();
              }
            });
          } else {
            finish();
          }
        }
        function finish() {
          if (path) {
            chronAssign(path[0], path[1]).then((expPath) => {
              contract.expire_path = expPath;
              ops.push({
                type: "put",
                path: ["contracts", from, contract.txid],
                data: contract,
              });
              if (dex.sellOrders) {
                dex.sellOrders[`${contract.rate}:${contract.txid}`] = contract;
              } else {
                dex.sellOrders = {
                  [`${contract.rate}:${contract.txid}`]: contract,
                };
              }
              let msg = `@${from} is selling ${parseFloat(
                parseInt(contract.amount) / 1000
              ).toFixed(3)} ${Config("TOKEN")} for ${parseFloat(
                parseInt(contract[order.pair]) / 1000
              ).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid
                })`;
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
                data: msg,
              });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            });
          } else {
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            store.batch(ops, pc);
          }
        }
      } else {
        const msg = `@${from}| tried to sell ${Config("TOKEN")} but sent an invalid order.`;
        if (Config("hookurl") || Config("status"))
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops = [
          {
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          },
        ];
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      }
    })
    .catch((e) => {
      console.log(e);
    });
};

export const transfer = (json, pc) => {
  json = naizer(json);
  if (
    Config("features").ico &&
    json.to == Config("mainICO") &&
    json.amount.nai == "@@000000021" &&
    json.from != Config("msaccount")
  ) {
    //the ICO disribution... should be in multi sig account
    const amount = parseInt(json.amount.amount);
    var purchase,
      Pstats = getPathObj(["stats"]),
      Pbal = getPathNum(["balances", json.from]),
      Pinv = getPathNum(["balances", "ri"]);
    Promise.all([Pstats, Pbal, Pinv]).then(function (v) {
      var stats = v[0],
        b = v[1],
        i = v[2],
        ops = [];
      if (!stats.outOnBlock) {
        purchase = parseInt((amount / stats.icoPrice) * 1000);
        if (purchase < i) {
          i -= purchase;
          b += purchase;
          const msg = `@${json.from}| bought ${parseFloat(
            purchase / 1000
          ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
            amount / 1000
          ).toFixed(3)} HIVE`;
          if (Config("hookurl") || Config("status"))
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops = [
            {
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: msg,
            },
            { type: "put", path: ["balances", json.from], data: b },
            { type: "put", path: ["balances", "ri"], data: i },
          ];
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        } else {
          b += i;
          const left = purchase - i;
          stats.outOnBlock = json.block_num;
          const msg = `@${json.from}| bought ALL ${parseFloat(
            parseInt(purchase - left)
          ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
            parseInt(amount) / 1000
          ).toFixed(3)} HIVE. And bid in the over-auction`;
          if (Config("hookurl") || Config("status"))
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops = [
            {
              type: "put",
              path: ["ico", `${json.block_num}`, json.from],
              data: parseInt((amount * left) / purchase),
            },
            { type: "put", path: ["balances", json.from], data: b },
            { type: "put", path: ["balances", "ri"], data: 0 },
            { type: "put", path: ["stats"], data: stats },
            {
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: msg,
            },
          ];
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        }
      } else {
        const msg = `@${json.from}| bought ALL ${parseFloat(
          parseInt(purchase - left)
        ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
          parseInt(amount) / 1000
        ).toFixed(3)} HIVE. And bid in the over-auction`;
        if (Config("hookurl") || Config("status"))
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops = [
          {
            type: "put",
            path: ["ico", `${json.block_num}`, json.from],
            data: parseInt(amount),
          },
          {
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          },
        ];
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      }
    });
  } else if (
    (Config("features").dex || Config("features").nft) &&
    json.to == Config("msaccount") &&
    json.from != Config("mainICO")
  ) {
    if (
      json.memo.split(" ").length > 1 &&
      json.memo.split(" ")[0] == "NFT"
    ) {
      let item = json.memo.split(" ")[1],
        setname = item.split(":")[0],
        Pset = getPathObj(["sets", setname]),
        Pstats = getPathObj(["stats"]),
        Pitem = getPathObj(["lth", item]),
        Pmsh = getPathObj(["stats", "ms", "active_account_auths"]);
      Promise.all([Pset, Pitem, Pstats, Pmsh]).then((mem) => {
        let set = mem[0],
          listing = mem[1],
          stats = mem[2],
          msholders = mem[3],
          amount = parseInt(json.amount.amount),
          type = json.amount.nai == "@@000000021" ? "HIVE" : "HBD",
          ops = [],
          qty = 0,
          refund_amount = amount,
          transfers = [],
          enf = enforce(listing.e),
          allowed = 9999999,
          whoBoughtIndex,
          whoBoughtAmount = 0;
        stats.MSHeld[type] += refund_amount;
        updateMSHeldValue(stats);
        if (msholders.includes(json.from) && json.memo == "IGNORE") {
          //console.log('IGNORE')
          pc[0](pc[2]);
        } else if (listing) {
          if (!listing.s) listing.s = "";
          if (enf.max) {
            allowed = enf.max;
            whoBoughtIndex = listing.s.indexOf(`${json.from}_`);
            if (whoBoughtIndex != -1) {
              whoBoughtAmount = parseInt(
                listing.s.split(`${json.from}_`)[1].split(",")[0]
              );
              allowed -= whoBoughtAmount;
            }
          }
          if (type == "HIVE" && amount >= listing.h && listing.h != 0) {
            qty = parseInt(amount / listing.h);
            refund_amount = amount % parseInt(listing.h);
            if (qty > allowed) {
              tor = qty - allowed;
              qty = allowed;
              refund_amount += tor * listing.h;
            }
          } else if (type == "HBD" && amount >= listing.b && listing.b != 0) {
            qty = parseInt(amount / listing.b);
            refund_amount = amount % parseInt(listing.b);
            if (qty > allowed) {
              tor = qty - allowed;
              qty = allowed;
              refund_amount += tor * listing.b;
            }
          }
          if (enf.max && whoBoughtIndex != -1) {
            listing.s.replace(
              `${json.from}_${whoBoughtAmount}`,
              `${json.from}_${whoBoughtAmount + qty}`
            );
          } else if (enf.max) {
            listing.s += `,${json.from}_${qty}`;
          }
          listing.q -= qty;
          if (enf.max) {
            if (!listing.p) listing.p = 0;
            listing.p += qty;
          }
          ops.push({ type: "put", path: ["lth", item], data: listing });
          if (listing.q <= 0) {
            qty += listing.q;
            refund_amount += listing.h * listing.q + listing.b * listing.q;
            if (!listing.p) ops.push({ type: "del", path: ["lth", item] });
          }
          if (qty && !enf.pb) {
            addMT(["rnfts", setname, json.from], parseInt(qty));
            transfers = [
              ...buildSplitTransfers(
                qty * listing.h + qty * listing.b,
                type,
                listing.d,
                `${qty} ${setname}${qty > 1 ? "'s" : ""} purchased - ${json.from
                }:${json.transaction_id.substr(0, 8)}:`
              ),
            ];
          } else if (qty && enf.pb) {
            addMT(["pcon", "lth", listing.i, json.from], parseInt(qty));
            postVerify(enf.pb, json.from, listing.i, "lth");
            transfers = [];
          }
          if (refund_amount) {
            transfers.push([
              "transfer",
              {
                to: json.from,
                from: Config("msaccount"),
                amount:
                  parseFloat(refund_amount / 1000).toFixed(3) + ` ${type}`,
                memo: `Refund ${setname} mint token purchase:${json.transaction_id}:`,
              },
            ]);
          }
          for (var i = 0; i < transfers.length; i++) {
            ops.push({
              type: "put",
              path: ["msa", `${i}:${json.transaction_id}:${json.block_num}`],
              data: stringify(transfers[i]),
            });
          }
          const msg = `@${json.from}| bought ${qty} ${setname} token${qty > 1 ? "s" : ""
            } with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} ${type}`;
          if (Config("hookurl") || Config("status"))
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
          ops.push({ type: "put", path: ["stats"], data: stats });
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        } else {
          ops.push({
            type: "put",
            path: ["msa", `${i}:${json.transaction_id}:${json.block_num}`],
            data: stringify([
              "transfer",
              {
                to: json.from,
                from: Config("msaccount"),
                amount: json.amount,
                memo: `Refund: Item(s) not found.`,
              },
            ]),
          });
          const msg = `@${json.from}| can't locate item(s). Refund in progress.`;
          if (Config("hookurl") || Config("status"))
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        }
      });
    } else if (
      json.memo.split(" ").length > 1 &&
      json.memo.split(" ")[0] == "NFTtrade"
    ) {
      let item = json.memo.split(" ")[1],
        setname = item.split(":")[0],
        uid = item.split(":")[1],
        Pstats = getPathObj(["stats"]),
        fnftp = getPathObj(["nfts", "t", item]),
        setp = getPathObj(["sets", setname]);
      Promise.all([fnftp, setp, Pstats])
        .then((nfts) => {
          var to,
            price,
            type,
            stats = nfts[2];
          try {
            to = nfts[0].t.split("_")[1];
            price = parseInt(nfts[0].t.split("_")[2]);
            type = nfts[0].t.split("_")[3];
            stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] +=
              parseInt(json.amount.amount);
            updateMSHeldValue(stats);
          } catch (e) {
            //console.log(nfts[0]);
          }
          if (
            nfts[0].s !== undefined &&
              to == json.from &&
              parseInt(json.amount.amount) == price &&
              (type == json.amount.nai) == "@@000000021"
              ? "HIVE"
              : "HBD"
          ) {
            let ops = [],
              nft = nfts[0],
              set = nfts[1];
            let royalties = parseInt((price * set.r) / 10000);
            let fee = parseInt((price * Config("hive_service_fee")) / 10000);
            let total = price - royalties - fee;
            const Transfer = [
              "transfer",
              {
                from: Config("msaccount"),
                to: nfts[0].t.split("_")[0],
                amount: parseFloat(total / 1000).toFixed(3) + ` ${type}`,
                memo: `${item} traded to ${json.from}.`,
              },
            ];
            if (royalties) {
              DEX.buyTokenFromDex(
                royalties,
                type,
                json.block_num,
                `roy_${json.transaction_id}`,
                `n:${set.n}`,
                json.timestamp
              ).then((empty) => {
                DEX.buyTokenFromDex(
                  fee,
                  type,
                  json.block_num,
                  `fee_${json.transaction_id}`,
                  `rn`,
                  json.timestamp
                ).then((emp) => {
                  finish(set, json, listing, uid, item, Transfer, nft, pc);
                });
              });
            } else {
              DEX.buyTokenFromDex(
                fee,
                type,
                json.block_num,
                `fee_${json.transaction_id}`,
                `rn`,
                json.timestamp
              ).then((emp) => {
                finish(set, json, listing, uid, item, Transfer, nft, pc);
              });
            }
            function finish(
              set,
              json,
              listing,
              uid,
              item,
              Transfer,
              nft,
              promise
            ) {
              var ops = [];
              nft.s = NFT.last(json.block_num, nft.s);
              set.u = NFT.move(uid, json.from, set.u);
              delete nft.t;
              ops.push({
                type: "put",
                path: ["nfts", json.from, `${setname}:${uid}`],
                data: nft,
              });
              ops.push({ type: "put", path: ["sets", setname], data: set });
              ops.push({
                type: "del",
                path: ["nfts", "t", `${setname}:${uid}`],
              });
              ops.push({
                type: "put",
                path: ["msa", `${json.block_num}:vop_${json.transaction_id}`],
                data: stringify(Transfer),
              });
              // is there anything in the NFT that needs to be modified? owner, renter,
              let msg = `@${json.from} completed NFT: ${setname}:${uid} transfer`;
              if (Config("hookurl") || Config("status"))
                postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: msg,
              });
              ops.push({ type: "put", path: ["stats"], data: stats });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, promise);
            }
          } else {
            const transfer = [
              "transfer",
              {
                to: json.from,
                from: Config("msaccount"),
                amount: json.amount,
                memo: `Failed trade. ${json.transaction_id.substr(0, 8)}`,
              },
            ];
            var ops = [];
            ops.push({
              type: "put",
              path: ["msa", `Failed:${setname}:${uid}:${json.transaction_id}`],
              data: stringify(transfer),
            });
            let msg = `@${json.from} trade of ${setname}:${uid} didn't go well.`;
            if (Config("hookurl") || Config("status"))
              postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
            ops.push({ type: "put", path: ["stats"], data: stats });
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            store.batch(ops, pc);
          }
        })
        .catch((e) => {
          console.log(e);
        });
    } else if (
      json.memo.split(" ").length > 1 &&
      json.memo.split(" ")[0] == "NFTbid"
    ) {
      let item = json.memo.split(" ")[1],
        set = item.split(":")[0],
        uid = item.split(":")[1];
      (ahp = getPathObj(["ahh", `${set}:${uid}`])),
        (Pstats = getPathObj(["stats"]));
      amount = parseInt(json.amount.amount);
      type = json.amount.nai == "@@000000021" ? "HIVE" : "HBD";
      Promise.all([ahp, Pstats])
        .then((mem) => {
          var stats = mem[1];
          stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] +=
            parseInt(json.amount.amount);
          updateMSHeldValue(stats);
          if (mem[0].h == type) {
            // && json.from != mem[0].f){ //check for item and type
            var listing = mem[0];
            if (listing.b) {
              if (amount > listing.b) {
                const transfer = [
                  "transfer",
                  {
                    to: listing.f,
                    from: Config("msaccount"),
                    amount:
                      parseFloat(listing.b / 1000).toFixed(3) + ` ${type}`,
                    memo: `Outbid on ${set}:${uid}. ${json.transaction_id.substr(
                      0,
                      8
                    )}`,
                  },
                ];
                var ops = [];
                ops.push({ type: "put", path: ["stats"], data: stats });
                ops.push({
                  type: "put",
                  path: ["msa", `Outbid:${set}:${uid}:${json.transaction_id}`],
                  data: stringify(transfer),
                });
                listing.f = json.from;
                listing.b = amount;
                listing.c++;
                ops.push({
                  type: "put",
                  path: ["ahh", `${set}:${uid}`],
                  data: listing,
                });
                let msg = `@${json.from} bid ${parseFloat(
                  amount / 1000
                ).toFixed(3)} ${type} on ${set}:${uid}'s auction`;
                if (Config("hookurl") || Config("status"))
                  postToDiscord(
                    msg,
                    `${json.block_num}:${json.transaction_id}`
                  );
                ops.push({
                  type: "put",
                  path: ["feed", `${json.block_num}:${json.transaction_id}`],
                  data: msg,
                });
                if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                store.batch(ops, pc);
              } else {
                const transfer = [
                  "transfer",
                  {
                    to: json.from,
                    from: Config("msaccount"),
                    amount: json.amount,
                    memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(
                      0,
                      8
                    )}`,
                  },
                ];
                var ops = [];
                ops.push({ type: "put", path: ["stats"], data: stats });
                ops.push({
                  type: "put",
                  path: [
                    "msa",
                    `Underbid:${set}:${uid}:${json.transaction_id}`,
                  ],
                  data: stringify(transfer),
                });
                let msg = `@${json.from} hasn't outbid on ${set}:${uid}`;
                if (Config("hookurl") || Config("status"))
                  postToDiscord(
                    msg,
                    `${json.block_num}:${json.transaction_id}`
                  );
                if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                store.batch(ops, pc);
              }
            } else if (amount >= listing.p) {
              listing.f = json.from;
              listing.b = amount;
              listing.c = 1;
              var ops = [];
              ops.push({ type: "put", path: ["stats"], data: stats });
              ops.push({
                type: "put",
                path: ["ahh", `${set}:${uid}`],
                data: listing,
              });
              let msg = `@${json.from} bid ${parseFloat(amount / 1000).toFixed(
                3
              )} ${type} on ${set}:${uid}'s auction`;
              if (Config("hookurl") || Config("status"))
                postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: msg,
              });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            } else {
              const transfer = [
                "transfer",
                {
                  to: json.from,
                  from: Config("msaccount"),
                  amount: json.amount,
                  memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(
                    0,
                    8
                  )}`,
                },
              ];
              var ops = [];
              ops.push({ type: "put", path: ["stats"], data: stats });
              ops.push({
                type: "put",
                path: ["msa", `Underbid:${set}:${uid}:${json.transaction_id}`],
                data: stringify(transfer),
              });
              let msg = `@${json.from} hasn't outbid on ${set}:${uid}`;
              if (Config("hookurl") || Config("status"))
                postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            }
          } else {
            const transfer = [
              "transfer",
              {
                to: json.from,
                from: Config("msaccount"),
                amount: json.amount,
                memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(
                  0,
                  8
                )}`,
              },
            ];
            var ops = [];
            ops.push({ type: "put", path: ["stats"], data: stats });
            ops.push({
              type: "put",
              path: ["msa", `Underbid:${set}:${uid}:${json.transaction_id}`],
              data: stringify(transfer),
            });
            let msg = `@${json.from} bid on ${set}:${uid} didn't go well.`;
            if (Config("hookurl") || Config("status"))
              postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            store.batch(ops, pc);
          }
        })
        .catch((e) => {
          console.log(e);
        });
    } else if (
      json.memo.split(" ").length > 1 &&
      json.memo.split(" ")[0] == "NFTbuy"
    ) {
      let item = json.memo.split(" ")[1],
        setname = item.split(":")[0],
        uid = item.split(":")[1],
        lsp = getPathObj(["ls", `${setname}:${uid}`]),
        setp = getPathObj(["sets", setname]),
        Pstats = getPathObj(["stats"]);
      amount = parseInt(json.amount.amount);
      type = json.amount.nai == "@@000000021" ? "HIVE" : "HBD";
      Promise.all([lsp, setp, Pstats])
        .then((mem) => {
          var stats = mem[2];
          stats.MSHeld[type] += amount;
          updateMSHeldValue(stats);
          if (mem[0].h == type && json.from != mem[0].o && amount == mem[0].p) {
            //check for item and type
            let listing = mem[0],
              set = mem[1],
              ops = [],
              promises = [],
              // const fee = parseInt(listing.b /100); add('n', fee); listingb = listing.b - fee;
              nft = listing.nft;
            const last_modified = nft.s.split(",")[0];
            nft.s.replace(last_modified, Base64.fromNumber(json.block_num)); //update last modified
            let royalties = parseInt((listing.p * set.r) / 10000);
            let fee = parseInt((listing.p * Config("hive_service_fee")) / 10000);
            let total = listing.p - royalties - fee;
            const Transfer = [
              "transfer",
              {
                from: Config("msaccount"),
                to: listing.o,
                amount: parseFloat(total / 1000).toFixed(3) + ` ${listing.h}`,
                memo: `${item} sold to ${json.from}.`,
              },
            ];
            if (royalties) {
              DEX.buyTokenFromDex(
                royalties,
                listing.h,
                json.block_num,
                `roy_${json.transaction_id}`,
                `n:${set.n}`,
                json.timestamp
              ).then((empty) => {
                DEX.buyTokenFromDex(
                  fee,
                  listing.h,
                  json.block_num,
                  `fee_${json.transaction_id}`,
                  `rn`,
                  json.timestamp
                ).then((emp) => {
                  finish(set, json, listing, uid, item, Transfer, nft, pc);
                });
              });
            } else {
              DEX.buyTokenFromDex(
                fee,
                listing.h,
                json.block_num,
                `fee_${json.transaction_id}`,
                `rn`,
                json.timestamp
              ).then((emp) => {
                finish(set, json, listing, uid, item, Transfer, nft, pc);
              });
            }
            function finish(
              set,
              json,
              listing,
              uid,
              item,
              Transfer,
              nft,
              promise
            ) {
              var ops = [];
              ops.push({ type: "put", path: ["stats"], data: stats });
              if (set != "Qm")
                set.u = NFT.move(uid, json.from, set.u); //update set
              else set.u = json.from;
              ops.push({
                type: "put",
                path: ["nfts", json.from, item],
                data: nft,
              }); //update nft
              const msg = `Sell of ${listing.o}'s ${item} finalized for ${Transfer[1].amount} to ${json.from}`;
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:vop_${json.transaction_id}`],
                data: msg,
              });
              ops.push({
                type: "put",
                path: ["msa", `${json.block_num}:vop_${json.transaction_id}`],
                data: stringify(Transfer),
              });
              if (Config("hookurl"))
                postToDiscord(
                  msg,
                  `${json.block_num}:vop_${json.transaction_id}`
                );
              if (set != "Qm")
                ops.push({
                  type: "put",
                  path: ["sets", set.n],
                  data: set,
                });
              //update set
              else
                ops.push({
                  type: "put",
                  path: ["sets", `Qm${uid}`],
                  data: set,
                });
              ops.push({ type: "del", path: ["ls", item] });
              store.batch(ops, promise);
            }
          } else {
            const transfer = [
              "transfer",
              {
                to: json.from,
                from: Config("msaccount"),
                amount: parseFloat(listing.b / 1000).toFixed(3) + ` ${type}`,
                memo: `Failed to buy ${setname}:${uid}. ${json.transaction_id.substr(
                  0,
                  8
                )}`,
              },
            ];
            var ops = [];
            ops.push({ type: "put", path: ["stats"], data: stats });
            ops.push({
              type: "put",
              path: ["msa", `FailedBuy:${set}:${uid}:${json.transaction_id}`],
              data: stringify(transfer),
            });
            let msg = `@${json.from} buy of ${set}:${uid} didn't go well.`;
            if (Config("hookurl") || Config("status"))
              postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            store.batch(ops, pc);
          }
        })
        .catch((e) => {
          console.log(e);
        });
    } else {
      let order = {
        type: "LIMIT",
      },
        path = "",
        waiting = Promise.resolve(""),
        contract = "";
      try {
        order = JSON.parse(json.memo);
      } catch (e) { }
      if (!order.rate) {
        order.type = "MARKET";
        order.rate = 0;
      } else {
        order.type = "LIMIT";
        order.rate = parseFloat(order.rate).toFixed(6);
      }
      if (parseFloat(order.rate) < 0) {
        order.type = "MARKET";
        order.rate = 0;
      }
      order.pair = json.amount.nai == "@@000000021" ? "hive" : "hbd";
      order.amount = parseInt(json.amount.amount);
      if (order.type == "MARKET" || order.type == "LIMIT") {
        let pDEX = getPathObj(["dex", order.pair]),
          pBal = getPathNum(["balances", json.from]),
          pInv = getPathNum(["balances", "ri"]),
          pStats = getPathObj(["stats"]);
        Promise.all([pDEX, pBal, pInv, pStats]).then((mem) => {
          let dex = mem[0],
            bal = mem[1],
            inv = mem[2],
            stats = mem[3],
            filled = 0,
            remaining = order.amount,
            ops = [],
            his = {},
            fee = 0,
            i = 0;
          if (typeof order.rate != "string") order.rate = dex.tick;
          stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] +=
            parseInt(json.amount.amount);
          updateMSHeldValue(stats);
          while (remaining) {
            //console.log('while')
            i++;
            
            // Initialize LP pool if needed
            initializeLpPool(dex);
            
            // Calculate curve price based on LP reserves
            const curvePrice = calculateCurvePrice(dex.pool.token, dex.pool[order.pair]);
            
            var price = dex.sellBook
              ? parseFloat(dex.sellBook.split("_")[0]).toFixed(6)
              : "";
            let item = "";
            if (price) item = dex.sellBook.split("_")[1].split(",")[0];
            else price = dex.tick;
            
            // Check if order provides better liquidity than LP
            const orderProvidesBetterLiquidity = item && parseFloat(price) < parseFloat(curvePrice);
            
            //console.log("Matching...", { order, price, item, curvePrice, orderProvidesBetterLiquidity });
            if (
              item &&
              (order.pair == "hbd" ||
                (order.pair == "hive" &&
                  (price <= stats.icoPrice / 1000 || !Config("features").ico))) &&
              (order.type == "MARKET" ||
                (order.type == "LIMIT" && order.rate >= price)) &&
              orderProvidesBetterLiquidity
            ) {
              var next = dex.sellOrders?.[`${price}:${item}`];
              //console.log("Matched order", { next });
              if (next && next[order.pair] <= remaining) {
                if (next[order.pair]) {
                  //console.log("Partial Fill");
                  filled += next.amount - next.fee;
                  bal += next.amount - next.fee; //update the balance
                  fee += next.fee; //add the fees
                  remaining -= next[order.pair];
                  dex.tick = next.rate;
                  his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                    type: "buy",
                    t: Date.parse(json.timestamp),
                    block: json.block_num,
                    base_vol: next.amount,
                    target_vol: next[order.pair],
                    target: order.pair,
                    price: next.rate,
                    id: json.transaction_id + i,
                  };
                  dex.sellBook = DEX.remove(item, dex.sellBook); //adjust the orderbook
                  delete dex.sellOrders[`${price}:${item}`];
                  const transfer = [
                    "transfer",
                    {
                      from: Config("msaccount"),
                      to: next.from,
                      amount:
                        parseFloat(next[order.pair] / 1000).toFixed(3) +
                        " " +
                        order.pair.toUpperCase(),
                      memo: `Filled ${item}:${json.transaction_id}`,
                    },
                  ];
                  let msg = `@${json.from} bought ${parseFloat(
                    parseInt(next.amount) / 1000
                  ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                    parseInt(next[order.pair]) / 1000
                  ).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from
                    } (${item})`;
                  ops.push({
                    type: "put",
                    path: [
                      "feed",
                      `${json.block_num}:${json.transaction_id}.${i}`,
                    ],
                    data: msg,
                  });
                  if (Object.keys(his).length)
                    ops.push({
                      type: "put",
                      path: ["dex", order.pair, "his"],
                      data: his,
                    });
                  ops.push({
                    type: "put",
                    path: ["msa", `${item}:${json.transaction_id}:${i}`],
                    data: stringify(transfer),
                  }); //send HIVE out via MS
                  ops.push({
                    type: "del",
                    path: ["dex", order.pair, "sellOrders", `${price}:${item}`],
                  }); //remove the order
                  ops.push({
                    type: "del",
                    path: ["contracts", next.from, item],
                  }); //remove the contract
                  ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
                } else {
                  //console.log("Only fees left...");
                  fee += next.fee;
                  fee += next.amount;
                  dex.sellBook = DEX.remove(item, dex.sellBook); //adjust the orderbook
                  delete dex.sellOrders[`${price}:${item}`];
                  ops.push({
                    type: "del",
                    path: ["dex", order.pair, "sellOrders", `${price}:${item}`],
                  }); //remove the order
                  ops.push({
                    type: "del",
                    path: ["contracts", next.from, item],
                  }); //remove the contract
                  ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
                }
              } else if (!next && dex.sellBook.indexOf(item) > -1) {
                console.log("Sell Book Error:", dex.sellBook);
                dex.sellBook = DEX.remove(item, dex.sellBook);
              } else {
                //console.log("Filled");
                next[order.pair] = next[order.pair] - remaining; // modify the contract
                const tokenAmount = parseInt(remaining / parseFloat(next.rate));
                const feeAmount = parseInt(
                  (tokenAmount / next.amount) * next.fee
                );
                filled += tokenAmount - feeAmount;
                bal += tokenAmount - feeAmount; //update the balance
                fee += feeAmount; //add the fees
                next.amount -= tokenAmount;
                next.fee -= feeAmount;
                his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                  type: "buy",
                  t: Date.parse(json.timestamp),
                  block: json.block_num,
                  base_vol: tokenAmount,
                  target_vol: remaining,
                  target: order.pair,
                  price: next.rate,
                  id: json.transaction_id + i,
                };
                if (!next.partial) {
                  next.partial = {
                    [json.transaction_id]: {
                      token: tokenAmount,
                      coin: remaining,
                    },
                  };
                } else {
                  next.partial[json.transaction_id] = {
                    token: tokenAmount,
                    coin: remaining,
                  };
                }
                dex.tick = next.rate;
                dex.sellOrders[`${price}:${item}`] = next;
                const transfer = [
                  "transfer",
                  {
                    from: Config("msaccount"),
                    to: next.from,
                    amount:
                      parseFloat(remaining / 1000).toFixed(3) +
                      " " +
                      order.pair.toUpperCase(),
                    memo: `Partial Filled ${item}:${json.transaction_id}`,
                  },
                ];
                let msg = `@${json.from} bought ${parseFloat(
                  parseInt(tokenAmount) / 1000
                ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                  parseInt(remaining) / 1000
                ).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from
                  } (${item})`;
                remaining = 0;
                ops.push({
                  type: "put",
                  path: [
                    "feed",
                    `${json.block_num}:${json.transaction_id}.${i}`,
                  ],
                  data: msg,
                });
                ops.push({
                  type: "put",
                  path: ["balances", json.from],
                  data: bal,
                });
                ops.push({
                  type: "put",
                  path: ["dex", order.pair, "his"],
                  data: his,
                });
                ops.push({
                  type: "put",
                  path: ["msa", `${item}:${json.transaction_id}:${i}`],
                  data: stringify(transfer),
                }); //send HIVE out via MS
                //ops.push({type: 'put', path: ['dex', order.pair, 'sellOrders', `${price.toFixed(6)}:${item}`], data: next}) //update the order
                ops.push({
                  type: "put",
                  path: ["contracts", next.from, item],
                  data: next,
                }); //update the contract
              }
            } else {
              if (
                Config("features").ico &&
                order.pair == "hive" &&
                (order.type == "MARKET" ||
                  (order.type == "LIMIT" &&
                    order.rate >= stats.icoPrice / 1000))
              ) {
                //console.log("ICO");
                let purchase;
                const transfer = [
                  "transfer",
                  {
                    from: Config("msaccount"),
                    to: Config("mainICO"),
                    amount:
                      parseFloat(remaining / 1000).toFixed(3) +
                      " " +
                      order.pair.toUpperCase(),
                    memo: `ICO Buy from ${json.from}:${json.transaction_id}`,
                  },
                ];
                ops.push({
                  type: "put",
                  path: [
                    "msa",
                    `ICO@${json.from}:${json.transaction_id}:${json.block_num}`,
                  ],
                  data: stringify(transfer),
                }); //send HIVE out via MS
                dex.tick = parseFloat(stats.icoPrice / 1000).toFixed(6);
                if (!stats.outOnBlock) {
                  purchase = parseInt((remaining / stats.icoPrice) * 1000);
                  filled += purchase;
                  if (purchase < inv) {
                    inv -= purchase;
                    bal += purchase;
                    his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                      type: "buy",
                      t: Date.parse(json.timestamp),
                      block: json.block_num,
                      base_vol: purchase,
                      target_vol: remaining,
                      target: order.pair,
                      price: parseFloat(stats.icoPrice / 1000).toFixed(6),
                      id: json.transaction_id + i,
                    };
                    const msg = `@${json.from}| bought ${parseFloat(
                      purchase / 1000
                    ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                      remaining / 1000
                    ).toFixed(3)} HIVE`;
                    ops.push(
                      {
                        type: "put",
                        path: [
                          "feed",
                          `${json.block_num}:${json.transaction_id}:${i}`,
                        ],
                        data: msg,
                      },
                      { type: "put", path: ["balances", "ri"], data: inv }
                    );
                  } else {
                    bal += inv;
                    const left = purchase - inv;
                    stats.outOnBlock = json.block_num;
                    his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                      type: "buy",
                      t: Date.parse(json.timestamp),
                      block: json.block_num,
                      base_vol: inv,
                      target_vol: remaining,
                      target: order.pair,
                      price: parseFloat(stats.icoPrice / 1000).toFixed(6),
                      id: json.transaction_id + i,
                    };
                    const msg = `@${json.from}| bought ALL ${parseFloat(
                      parseInt(purchase - left)
                    ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                      parseInt(amount) / 1000
                    ).toFixed(3)} HIVE. And bid in the over-auction`;
                    ops.push(
                      {
                        type: "put",
                        path: ["ico", `${json.block_num}`, json.from],
                        data: parseInt((amount * left) / purchase),
                      },
                      { type: "put", path: ["balances", "ri"], data: 0 },
                      {
                        type: "put",
                        path: [
                          "feed",
                          `${json.block_num}:${json.transaction_id}`,
                        ],
                        data: msg,
                      }
                    );
                  }
                  remaining = 0;
                } else {
                  const msg = `@${json.from}| bought ALL ${parseFloat(
                    parseInt(purchase - left)
                  ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                    parseInt(amount) / 1000
                  ).toFixed(3)} HIVE. And bid in the over-auction`;
                  if (Config("hookurl") || Config("status"))
                    postToDiscord(
                      msg,
                      `${json.block_num}:${json.transaction_id}`
                    );
                  ops = [
                    {
                      type: "put",
                      path: ["ico", `${json.block_num}`, json.from],
                      data: parseInt(amount),
                    },
                    {
                      type: "put",
                      path: [
                        "feed",
                        `${json.block_num}:${json.transaction_id}`,
                      ],
                      data: msg,
                    },
                  ];
                  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                  ops.push({ type: "put", path: ["stats"], data: stats });
                  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                  store.batch(ops, pc);
                }
              } else {
                // Try LP swap if we have reserves and it's allowed by collateral limits
                if (dex.pool && dex.pool.token > 0 && dex.pool[order.pair] > 0 && parseFloat(curvePrice) > 0) {
                  // Check collateral limits - already holding the HIVE/HBD so no additional check needed
                  // Execute LP swap
                  const swapResult = executeLpSwap(remaining, order.pair, dex, stats);
                  
                  if (swapResult.success && swapResult.amountOut > 0) {
                    // LP swap successful
                    filled += swapResult.amountOut;
                    bal += swapResult.amountOut;
                    dex.tick = swapResult.newTick;
                    
                    // Create history entry for LP swap
                    his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                      type: "buy",
                      t: Date.parse(json.timestamp),
                      block: json.block_num,
                      base_vol: swapResult.amountOut,
                      target_vol: remaining,
                      target: order.pair,
                      price: swapResult.newTick,
                      id: json.transaction_id + i,
                    };
                    
                    let msg = `@${json.from} bought ${parseFloat(
                      parseInt(swapResult.amountOut) / 1000
                    ).toFixed(3)} ${Config("TOKEN")} with ${parseFloat(
                      parseInt(remaining) / 1000
                    ).toFixed(3)} ${order.pair.toUpperCase()} via LP swap`;
                    
                    ops.push({
                      type: "put",
                      path: [
                        "feed",
                        `${json.block_num}:${json.transaction_id}.${i}`,
                      ],
                      data: msg,
                    });
                    
                    // Calculate and distribute fees
                    const lpFee = parseInt(swapResult.amountOut * (parseFloat(stats.dex_fee) || 0.005));
                    fee += lpFee;
                    bal -= lpFee; // Remove fee from balance
                    
                    remaining = 0;
                    i++;
                    continue;
                  }
                }
                
                // If LP swap failed or not available, create limit order
                console.log("Building contract");
                const txid =
                  Config("TOKEN") + hashThis(json.from + json.transaction_id),
                  crate = parseFloat(order.rate) > 0 ? order.rate : dex.tick,
                  toRefund = maxAllowed(stats, dex.tick, remaining, crate);
                remaining = remaining - toRefund;
                console.log({ toRefund, remaining });
                const hours = 720,
                  expBlock = json.block_num + hours * 1200;
                if (toRefund) {
                  const transfer = [
                    "transfer",
                    {
                      from: Config("msaccount"),
                      to: json.from,
                      amount:
                        parseFloat(toRefund / 1000).toFixed(3) +
                        " " +
                        order.pair.toUpperCase(),
                      memo: `Partial refund due to collateral limits ${json.from}:${json.transaction_id}`,
                    },
                  ];
                  ops.push({
                    type: "put",
                    path: [
                      "msa",
                      `Refund@${json.from}:${json.transaction_id}:${json.block_num}`,
                    ],
                    data: stringify(transfer),
                  });
                }
                contract = {
                  txid,
                  from: json.from,
                  hive: 0,
                  hbd: 0,
                  fee: 0,
                  amount: 0,
                  rate: crate,
                  block: json.block_num,
                  type: `${order.pair}:buy`,
                  hive_id: json.transaction_id,
                };
                contract.amount = parseInt(remaining / crate);
                (contract.fee =
                  parseFloat(stats.dex_fee) > 0
                    ? parseInt(
                      parseInt(contract.amount) * parseFloat(stats.dex_fee)
                    ) + 1
                    : parseInt(contract.amount * 0.005) + 1),
                  (contract[order.pair] = remaining);
                if (remaining) {
                  dex.buyBook = DEX.insert(txid, crate, dex.buyBook, "buy");
                  path = chronAssign(expBlock, {
                    block: expBlock,
                    op: "expire",
                    from: json.from,
                    txid,
                  });
                  remaining = 0;
                }
                console.log({ contract });
              }
            }
          }
          let msg = "";
          if (remaining == order.amount) {
            msg = `@${json.from} set a buy order at ${contrate.rate}.`;
          } else if (json.from != "rn") {
            msg = `@${json.from} | order received.`;
            waiting = add("rn", fee);
          } else {
            console.log({ fee });
            msg = `@${json.from} | order received.`;
            bal += fee;
          }
          if (Config("hookurl") || Config("status"))
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({ type: "put", path: ["balances", json.from], data: bal });
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}.${i++}`],
            data: msg,
          });
          if (Object.keys(his).length)
            ops.push({
              type: "put",
              path: ["dex", order.pair, "his"],
              data: his,
            });
          if (!path) {
            Promise.all([waiting]).then((empty) => {
              ops.push({ type: "put", path: ["dex", order.pair], data: dex });
              ops.push({ type: "put", path: ["stats"], data: stats });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            });
          } else {
            Promise.all([path, waiting]).then((expPath) => {
              contract.expire_path = expPath[0];
              ops.push({
                type: "put",
                path: ["contracts", json.from, contract.txid],
                data: contract,
              });
              if (dex.buyOrders) {
                dex.buyOrders[`${contract.rate}:${contract.txid}`] = contract;
              } else {
                dex.buyOrders = {
                  [`${contract.rate}:${contract.txid}`]: contract,
                };
              }
              let msg = `@${json.from} is buying ${parseFloat(
                parseInt(contract.amount) / 1000
              ).toFixed(3)} ${Config("TOKEN")} for ${parseFloat(
                parseInt(contract[order.pair]) / 1000
              ).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid
                })`;
              ops.push({ type: "put", path: ["dex", order.pair], data: dex });
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
                data: msg,
              });
              ops.push({ type: "put", path: ["stats"], data: stats });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            });
          }
        });
      } else {
        const transfer = [
          "transfer",
          {
            from: Config("msaccount"),
            to: json.from,
            amount: json.amount,
            memo: `This doesn't appear to be formatted correctly to buy ${Config("TOKEN")}`,
          },
        ];
        let msg = `@${json.from} sent a weird transaction to ${Config("msaccount")}: refunding`;
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
          data: msg,
        });
        ops.push({
          type: "put",
          path: [
            "msa",
            `refund@${json.from}:${json.transaction_id}:${json.block_num}`,
          ],
          data: stringify(transfer),
        });
        ops.push({ type: "put", path: ["stats"], data: stats });
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      }
    }
  } else if (Config("features").dex && json.from == Config("msaccount")) {
    var Pmss = getPathObj(["mss"]),
      Pstats = getPathObj(["stats"]);

    Promise.all([Pmss, Pstats]).then((mem) => {
      var mss = mem[0],
        stats = mem[1];
      stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] -=
        parseInt(json.amount.amount);
      updateMSHeldValue(stats);
      var ops = [{ type: "put", path: ["stats"], data: stats }];
      for (var block in mss) {
        if (block.split(":").length < 2 && mss[block].indexOf(json.memo) > 0) {
          ops.push({ type: "del", path: ["mss", `${block}`] });
          ops.push({ type: "del", path: ["mss", `${block}:sigs`] });
          break;
        }
      }
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    });
  } else {
    pc[0](pc[2]);
  }
};

export const dex_clear = (json, from, active, pc) => {
  if (active) {
    var q = [];
    if (typeof json.txid == "string") {
      q.push(json.txid);
    } else {
      console.log('Else continue dex_clear')
      pc[0](pc[2]);
    }
    // else {
    //     q = json.txid
    // } //book string collision
    for (var i = 0; i < q.length; i++) {
      store.get(["contracts", from, q[i]], function (e, a) {
        if (!e) {
          var b = a;
          switch (b.type) {
            case "hive:sell":
              store.get(
                ["dex", "hive", "sellOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    console.log('Error Continue')
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            case "hbd:sell":
              store.get(
                ["dex", "hbd", "sellOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            case "hive:buy":
              store.get(
                ["dex", "hive", "buyOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            case "hbd:buy":
              store.get(
                ["dex", "hbd", "buyOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            default:
              pc[0](pc[2]);
          }
        } else {
          pc[0](pc[2]);
          console.log(e);
        }
      });
    }
  } else {
    pc[0](pc[2]);
  }
};

function buildSplitTransfers(amount, pair, ds, memos) {
  console.log({ amount, pair, ds, memos });
  let tos = ds.split(",") || 0;
  if (!tos) return [];
  let ops = [],
    total = 0;
  for (var i = tos.length - 1; i >= 0; i--) {
    let dis = parseInt((amount * parseInt(tos[i].split("_")[1])) / 10000);
    if (!i) dis = amount - total;
    total += dis;
    ops.push([
      "transfer",
      {
        to: tos[i].split("_")[0],
        from: Config("msaccount"),
        amount: `${parseFloat(dis / 1000).toFixed(3)} ${pair.toUpperCase()}`,
        memo:
          memos +
          `:${parseFloat(parseInt(tos[i].split("_")[1]) / 100).toFixed(2)}%`,
      },
    ]);
  }
  return ops;
}

function enforce(str) {
  str = str || "";
  let enforce = {},
    arr = str.split(",");
  for (let i = 0; i < arr.length; i++) {
    let s = arr[i].split(":");
    enforce[s[0]] = arr[i].replace(`${s[0]}:`, "");
  }
  return enforce;
}

/*
function postVerify(str, from, loc){
    fetch("https://api.hive.blog", {
        body: `{"jsonrpc":"2.0", "method":"bridge.get_account_posts", "params":{"sort":"posts", "account": "${from}", "limit": 25}, "id":1}`,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST"
    })
    .then(res => res.json()).then(json => {
        var valid = false
        for(var i = 0; i < json.result.length; i++){
            if(new Date(`${json.result[i].created}.000Z`).getTime() > new Date(`${str.split('_')[0]}:00.000Z`).getTime() && new Date(`${json.result[i].created}.000Z`).getTime() < new Date(`${str.split('_')[1]}:00.000Z`).getTime()){
                    valid = true
                    break 
            }
        }
        if (plasma.oracle){
            plasma.oracle[`${loc}:${from}`] = 'lth:' + valid
        } else {
            plasma.oracle = {}
            plasma.oracle[`${loc}:${from}`] = 'lth:' + valid
        }
    })
}
*/
export const release = (from, txid, bn, tx_id) => {
  return new Promise((resolve, reject) => {
    store.get(["contracts", from, txid], function (er, a) {
      if (er) {
        console.log(er);
      } else {
        var ops = [];
        switch (a.type) {
          case "hive:sell":
            store.get(["dex", "hive"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.sellOrders[`${a.rate}:${a.txid}`];
                res.sellBook = DEX.remove(a.txid, res.sellBook);
                ops.push({
                  type: "put",
                  path: ["dex", "hive", "sellBook"],
                  data: res.sellBook,
                });
                add(r.from, r.amount)
                  .then((empty) => {
                    ops.push({ type: "del", path: ["contracts", from, txid] });
                    ops.push({ type: "del", path: ["chrono", a.expire_path] });
                    ops.push({
                      type: "del",
                      path: [
                        "dex",
                        "hive",
                        "sellOrders",
                        `${a.rate}:${a.txid}`,
                      ],
                    });
                    if (tx_id && Config("hookurl")) {
                      postToDiscord(
                        `@${from} has canceled ${txid}`,
                        `${bn}:${tx_id}`
                      );
                    }
                    store.batch(ops, [resolve, reject]);
                  })
                  .catch((e) => {
                    reject(e);
                  });
              }
            });
            break;
          case "hbd:sell":
            store.get(["dex", "hbd"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.sellOrders[`${a.rate}:${a.txid}`];
                res.sellBook = DEX.remove(a.txid, res.sellBook);
                ops.push({
                  type: "put",
                  path: ["dex", "hbd", "sellBook"],
                  data: res.sellBook,
                });
                add(r.from, r.amount)
                  .then((empty) => {
                    ops.push({ type: "del", path: ["contracts", from, txid] });
                    ops.push({ type: "del", path: ["chrono", a.expire_path] });
                    ops.push({
                      type: "del",
                      path: ["dex", "hbd", "sellOrders", `${a.rate}:${a.txid}`],
                    });
                    if (tx_id && Config("hookurl")) {
                      postToDiscord(
                        `@${from} has canceled ${txid}`,
                        `${bn}:${tx_id}`
                      );
                    }
                    store.batch(ops, [resolve, reject]);
                  })
                  .catch((e) => {
                    reject(e);
                  });
              }
            });
            break;
          case "hive:buy":
            store.get(["dex", "hive"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.buyOrders[`${a.rate}:${a.txid}`];
                res.buyBook = DEX.remove(a.txid, res.buyBook);
                ops.push({
                  type: "put",
                  path: ["dex", "hive", "buyBook"],
                  data: res.buyBook,
                });
                a.cancel = true;
                const Transfer = [
                  "transfer",
                  {
                    from: Config("msaccount"),
                    to: a.from,
                    amount: parseFloat(a.hive / 1000).toFixed(3) + " HIVE",
                    memo: `Canceled ${Config("TOKEN")} buy ${a.txid}`,
                  },
                ];
                ops.push({
                  type: "put",
                  path: ["msa", `refund@${a.from}:${a.txid}:${bn}`],
                  data: stringify(Transfer),
                });
                ops.push({ type: "del", path: ["contracts", from, a.txid] });
                ops.push({
                  type: "del",
                  path: ["dex", "hive", "buyOrders", `${a.rate}:${a.txid}`],
                });
                if (tx_id && Config("hookurl")) {
                  postToDiscord(
                    `@${from} has canceled ${txid}`,
                    `${bn}:${tx_id}`
                  );
                }
                store.batch(ops, [resolve, reject]);
              }
            });
            break;
          case "hbd:buy":
            store.get(["dex", "hbd"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.buyOrders[`${a.rate}:${a.txid}`];
                res.buyBook = DEX.remove(a.txid, res.buyBook);
                ops.push({
                  type: "put",
                  path: ["dex", "hbd", "buyBook"],
                  data: res.buyBook,
                });
                a.cancel = true;
                const Transfer = [
                  "transfer",
                  {
                    from: Config("msaccount"),
                    to: a.from,
                    amount: parseFloat(a.hbd / 1000).toFixed(3) + " HBD",
                    memo: `Canceled ${Config("TOKEN")} buy ${a.txid}`,
                  },
                ];
                ops.push({
                  type: "put",
                  path: ["msa", `refund@${a.from}:${a.txid}:${bn}`],
                  data: stringify(Transfer),
                });
                ops.push({ type: "del", path: ["contracts", from, a.txid] });
                ops.push({
                  type: "del",
                  path: ["dex", "hbd", "buyOrders", `${a.rate}:${a.txid}`],
                });
                if (tx_id && Config("hookurl")) {
                  postToDiscord(
                    `@${from} has canceled ${txid}`,
                    `${bn}:${tx_id}`
                  );
                }
                store.batch(ops, [resolve, reject]);
              }
            });
            break;
          default:
            resolve();
        }
      }
    });
  });
};

//change stats to msheld {}
export const witness_mod = async function (bn, prand, stats, realTime, runtimeContext, bh) {
  return new Promise(async (resolve, reject) => {
    if (!bh || !bh.witness) {
      console.log('witness_mod: Missing block header or witness', { bn, bh });
      return resolve();
    }
    store.batch([{ type: "put", path: ["witness", `${bn % 100}`], data: bh.witness }], [resolve, reject])
  })
}

export const margins = function (bn) {
  return new Promise((resolve, reject) => {
    var Pstats = getPathObj(["stats"]),
      Pdex = getPathObj(["dex"]),
      Pmsa = getPathObj(["msa"]),
      Pmss = getPathObj(["mss"]),
      Pwitness = getPathObj(["witness"]);
    Promise.all([Pstats, Pdex, Pmsa, Pmss, Pwitness]).then((mem) => {
      var stats = mem[0],
        dex = mem[1],
        msa = mem[2],
        mss = mem[3];
      if (Object.keys(msa).length)
        for (var x in msa) {
          if (typeof msa[x] == "string")
            msa[x].split('amount":"').forEach((y) => {
              const amount = y.split('"')[0],
                type = amount.split(" ")[1],
                mt = parseInt(parseFloat(amount.split(" ")[0]) * 1000);
              if (type == "HIVE") {
                stats.MSHeld.HIVE -= mt;
              } else if (type == "HBD") {
                stats.MSHeld.HBD -= mt;
              }
            });
        }
      if (Object.keys(mss).length)
        for (var x in mss) {
          if (typeof mss[x] == "string")
            mss[x].split('amount":"').forEach((y) => {
              const amount = y.split('"')[0],
                type = amount.split(" ")[1],
                mt = parseInt(parseFloat(amount.split(" ")[0]) * 1000);
              if (type == "HIVE") {
                stats.MSHeld.HIVE -= mt;
              } else if (type == "HBD") {
                stats.MSHeld.HBD -= mt;
              }
            });
        }
      // Update MSHeld.VALUE after adjusting for pending transfers
      updateMSHeldValue(stats);
      
      var allowedHive = parseInt(
        stats.multiSigCollateral * parseFloat(dex.hive.tick)
      ),
        allowedHBD = parseInt(
          stats.multiSigCollateral * parseFloat(dex.hbd.tick)
        ),
        changed = [],
        promises = [];
      if (stats.MSHeld.HIVE > allowedHive)
        console.log(stats.MSHeld.HIVE, { allowedHive });
      if (stats.MSHeld.HIVE > allowedHive) {
        var p = dex.hive.buyBook.split(","),
          price = p[p.length - 1].split("_")[0],
          items = p[p.length - 1].split("_");
        for (var i = 1; i < items.length; i++) {
          if (dex.hive.buyOrders[`${price}:${items[i]}`])
            promises.push(
              release(
                dex.hive.buyOrders[`${price}:${items[i]}`].from,
                items[i],
                bn,
                `${bn}_hive_collateral_vop`
              )
            );
          else {
            changed.push([items[i], "hive"]);
          }
        }
      }
      if (stats.MSHeld.HBD > allowedHBD) {
        var p = dex.hbd.buyBook.split(","),
          price = p[p.length - 1].split("_")[0],
          items = p[p.length - 1].split("_");
        for (var i = 1; i < items.length; i++) {
          if (dex.hbd.buyOrders[`${price}:${items[i]}`])
            promises.push(
              release(
                dex.hbd.buyOrders[`${price}:${items[i]}`].from,
                items[i],
                bn,
                `${bn}_hbd_collateral_vop`
              )
            );
          else {
            changed.push([items[i], "hbd"]);
          }
        }
      }
      if (promises.length > 0) {
        Promise.all(promises).then(() => {
          if (!changed.length) resolve("Pruned");
          else removeItems(changed, resolve);
        });
      } else {
        if (!changed.length) resolve("No pruning");
        else removeItems(changed, resolve);
      }
    });
  });
};


export const feed_publish = (tx, pc, runtimeContext) => {

  const { store, getPathObj } = runtimeContext;
  const publisher = tx.publisher;

  // Get witness rolling buffer and price feeds
  let promises = [
    getPathObj(['witness']), // Rolling witness buffer (last 100 blocks)
    getPathObj(['priceFeeds']), // Current price feeds
    getPathObj(['stats']) // Stats object
  ];

  Promise.all(promises).then(mem => {
    const witnessBuffer = mem[0] || {};
    const priceFeeds = mem[1] || {};
    const stats = mem[2] || {};

    // Count how many blocks this publisher has witnessed in last 100 blocks
    let witnessCount = 0;
    for (let key in witnessBuffer) {
      if (witnessBuffer[key] === publisher) {
        witnessCount++;
      }
    }

    // Only accept price feed from witnesses who signed at least 4 blocks
    if (witnessCount >= 4) {
      const base = feedPriceNIAzer(tx.exchange_rate.base)
      const quote = feedPriceNIAzer(tx.exchange_rate.quote)
      console.log(base, quote)
      const hivePerHbd = parseFloat((quote / base)).toFixed(3);

      // Store price feed with block number for staleness checking
      priceFeeds[publisher] = {
        hivePerHbd: hivePerHbd,
        block: tx.block_num, // Current block number from pc context
        witnessCount: witnessCount
      };

      // Clean stale price feeds (from non-consensus witnesses)
      const consensusWitnesses = {};
      for (let key in witnessBuffer) {
        const witness = witnessBuffer[key];
        consensusWitnesses[witness] = (consensusWitnesses[witness] || 0) + 1;
      }

      // Remove price feeds from witnesses not in consensus (< 4 blocks)
      for (let witness in priceFeeds) {
        if ((consensusWitnesses[witness] || 0) < 4) {
          delete priceFeeds[witness];
        }
      }

      // Calculate median price if we have enough feeds
      const activePrices = Object.values(priceFeeds).map(feed => feed.hivePerHbd);
      if (activePrices.length >= 3) {
        // Sort prices to find median
        activePrices.sort((a, b) => a - b);
        const medianIndex = Math.floor(activePrices.length / 2);

        let medianHivePerHbd;
        if (activePrices.length % 2 === 0) {
          // Even number of prices - average the two middle values
          medianHivePerHbd = (parseFloat(activePrices[medianIndex - 1]) + parseFloat(activePrices[medianIndex])) / 2;
        } else {
          // Odd number of prices - take the middle value
          medianHivePerHbd = parseFloat(activePrices[medianIndex]);
        }

        // Update stats with median prices
        stats.priceFeed = {
          hivePerHbd: medianHivePerHbd.toFixed(4),
          hbdPrice: 1, // HBD is designed to be $1 USD
          hivePrice: parseFloat(1.0 / medianHivePerHbd).toFixed(4), // HIVE price in HBD
          lastUpdate: tx.block_num, // Block number
          activePriceFeeds: activePrices.length
        };
        
        // Update MSHeld.VALUE with new price feed
        updateMSHeldValue(stats);
      }

      // Store updated data
      const ops = [
        { type: 'put', path: ['priceFeeds'], data: priceFeeds },
        { type: 'put', path: ['stats'], data: stats }
      ];

      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    } else {
      // Publisher hasn't signed enough blocks, ignore their price feed
      pc[0](pc[2]);
    }
  }).catch(e => {
    console.error('Error processing feed_publish:', e);
    pc[1](e);
  });
}


function removeItems(arr, p) {
  let phive = getPathObj(["dex", "hive", "buyBook"]),
    phbd = getPathObj(["dex", "hbd", "buyBook"]);
  Promise.all([phive, phbd]).then((mem) => {
    var hive = mem[0],
      hbd = mem[1];
    for (var i = 0; i < arr.length; i++) {
      console.log("Cleaned: ", arr[i][0]);
      if (arr[i][1] == "hive") hive = DEX.remove(arr[i][0], hive);
      if (arr[i][1] == "hbd") hbd = DEX.remove(arr[i][0], hbd);
    }
    store.batch(
      [
        { type: "put", path: ["dex", "hive", "buyBook"], data: hive },
        { type: "put", path: ["dex", "hbd", "buyBook"], data: hbd },
      ],
      [p, "error", "Pruned"]
    );
  });
}

function nai(obj) {
  return `${parseFloat(obj.amount.amount / Math.pow(10, obj.precision))} ${obj.amount.nai == "@@000000021" ? "HIVE" : "HBD"
    }`;
}
function naizer(obj) {
  if (typeof obj.amount != "string") return obj;
  else {
    const nai =
      obj.amount.split(" ")[1] == "HIVE" ? "@@000000021" : "@@000000013";
    const amount = parseInt(
      parseFloat(obj.amount.split(" ")[0]) * 1000
    ).toString();
    const precision = 3;
    obj.amount = {
      amount,
      nai,
      precision,
    };
    return obj;
  }
}

function feedPriceNIAzer(obj) {
  if (typeof obj.amount != "string") { //feed prices
    return parseInt(
      parseFloat(obj.split(" ")[0]) * 1000
    )
  } else {
    return obj.amount;
  }
}

function maxAllowed(stats, tick, remaining, crate) {
  const max =
    stats.safetyLimit *
    tick *
    (1 - (crate < tick ? crate / tick : 0) * (stats.dex_slope / 100)) *
    (stats.dex_max / 100);
  return max > remaining ? 0 : parseInt(remaining - max);
}
