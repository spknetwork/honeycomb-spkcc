/**
 * Enhanced DEX handlers that integrate with token registry
 * Supports both hardcoded tokens and dynamically registered tokens
 */

import { handleDEXTrade as handleFlexibleDEX } from './dex_handlers_flexible.js';
import { getRegisteredTokenConfig, processAuctionBid } from './token_registry.js';

/**
 * Enhanced DEX handler that checks token registry first
 */
export const handleDEXTrade = async (json, pc, context) => {
  const { getPathObj } = context;
  
  // Check if this is an auction bid first
  const memoWords = json.memo.split(' ');
  if (memoWords[0] === 'AUCTION') {
    const handled = await processAuctionBid(json, pc, context);
    if (handled) return;
  }
  
  // Parse order from memo
  let order = {
    type: "LIMIT",
    token: context.config.TOKEN // Default token
  };
  
  try {
    order = JSON.parse(json.memo);
  } catch (e) {
    // Not JSON, use defaults
  }
  
  // Check if token is registered
  if (order.token) {
    const registeredConfig = await getRegisteredTokenConfig(order.token, context);
    
    if (registeredConfig) {
      // Enhance context with registered token config
      context.config = {
        ...context.config,
        tokenDexMap: {
          ...context.config.tokenDexMap,
          [order.token]: registeredConfig
        }
      };
    }
  }
  
  // Use flexible DEX handler
  return handleFlexibleDEX(json, pc, context);
};

/**
 * Enhanced LP swap that respects registered token fee rates
 */
export const executeLpSwapWithRegistry = async (amountIn, pair, dex, stats, tokenSymbol, context) => {
  const { getPathObj } = context;
  
  const result = {
    success: false,
    amountOut: 0,
    newTick: dex.tick,
    fee: 0
  };

  if (!dex.pool || dex.pool.token <= 0 || dex.pool[pair] <= 0) {
    return result;
  }

  // Get fee rate from registry if available
  let feeRate = parseFloat(stats.dex_fee) || 0.003; // Default 0.3%
  
  if (tokenSymbol) {
    const token = await getPathObj(['tokens', tokenSymbol]);
    if (token && token.amm && token.amm.feeRate) {
      feeRate = token.amm.feeRate;
    }
  }

  // Constant product formula with fee
  const amountInWithFee = amountIn * (1 - feeRate);
  const k = dex.pool.token * dex.pool[pair];
  const newCurrencyReserve = dex.pool[pair] + amountInWithFee;
  const newTokenReserve = k / newCurrencyReserve;
  const tokenOut = dex.pool.token - newTokenReserve;

  if (tokenOut > 0 && tokenOut < dex.pool.token * 0.1) {
    // Limit to 10% of pool
    dex.pool[pair] = newCurrencyReserve;
    dex.pool.token = newTokenReserve;
    
    result.success = true;
    result.amountOut = Math.floor(tokenOut);
    result.newTick = (dex.pool[pair] / dex.pool.token).toFixed(6);
    result.fee = Math.floor(amountIn * feeRate);
  }

  return result;
};

/**
 * Check if a token has sufficient liquidity for trading
 */
export const checkTokenLiquidity = async (tokenSymbol, pair, context) => {
  const { getPathObj } = context;
  
  const token = await getPathObj(['tokens', tokenSymbol]);
  if (!token || !token.amm.enabled) {
    return { hasLiquidity: false, reason: 'Token not found or AMM not enabled' };
  }
  
  const dex = await getPathObj([token.paths.dex, pair]);
  if (!dex || !dex.pool) {
    return { hasLiquidity: false, reason: 'No pool exists' };
  }
  
  const liquidity = dex.pool.token * dex.pool[pair];
  if (liquidity < token.amm.minLiquidity) {
    return { 
      hasLiquidity: false, 
      reason: `Insufficient liquidity: ${liquidity} < ${token.amm.minLiquidity}` 
    };
  }
  
  return {
    hasLiquidity: true,
    pool: dex.pool,
    tick: dex.tick
  };
};

/**
 * Calculate optimal swap route for registered tokens
 * Supports multi-hop swaps through common pairs
 */
export const calculateSwapRoute = async (fromToken, toToken, amount, context) => {
  const { getPathObj } = context;
  
  // Direct swap check
  if (fromToken === 'HIVE' || fromToken === 'HBD') {
    // Direct fiat to token
    const token = await getPathObj(['tokens', toToken]);
    if (token && token.amm.pools[fromToken.toLowerCase()]) {
      return [{
        from: fromToken,
        to: toToken,
        pool: fromToken.toLowerCase(),
        type: 'direct'
      }];
    }
  } else if (toToken === 'HIVE' || toToken === 'HBD') {
    // Direct token to fiat
    const token = await getPathObj(['tokens', fromToken]);
    if (token && token.amm.pools[toToken.toLowerCase()]) {
      return [{
        from: fromToken,
        to: toToken,
        pool: toToken.toLowerCase(),
        type: 'direct'
      }];
    }
  } else {
    // Token to token - need intermediate hop
    const fromTokenData = await getPathObj(['tokens', fromToken]);
    const toTokenData = await getPathObj(['tokens', toToken]);
    
    if (!fromTokenData || !toTokenData) {
      return null;
    }
    
    // Find common pool (prefer HIVE over HBD)
    const commonPools = ['hive', 'hbd'].filter(pool => 
      fromTokenData.amm.pools[pool] && toTokenData.amm.pools[pool]
    );
    
    if (commonPools.length > 0) {
      return [
        {
          from: fromToken,
          to: commonPools[0].toUpperCase(),
          pool: commonPools[0],
          type: 'hop1'
        },
        {
          from: commonPools[0].toUpperCase(),
          to: toToken,
          pool: commonPools[0],
          type: 'hop2'
        }
      ];
    }
  }
  
  return null;
};

/**
 * Execute multi-hop swap for registered tokens
 */
export const executeMultiHopSwap = async (route, amount, minAmountOut, from, context) => {
  const { store, getPathObj, getPathNum } = context;
  let currentAmount = amount;
  const ops = [];
  const swapDetails = [];
  
  for (const hop of route) {
    if (hop.type === 'direct' || hop.type === 'hop1') {
      // Swap from source token
      const tokenData = await getPathObj(['tokens', hop.from]);
      const dex = await getPathObj([tokenData.paths.dex, hop.pool]);
      
      const swapResult = await executeLpSwapWithRegistry(
        currentAmount, 
        hop.pool, 
        dex, 
        {}, // stats
        hop.from,
        context
      );
      
      if (!swapResult.success) {
        return { success: false, reason: 'Swap failed at ' + hop.from };
      }
      
      currentAmount = swapResult.amountOut;
      swapDetails.push({
        hop,
        amountIn: currentAmount,
        amountOut: swapResult.amountOut,
        fee: swapResult.fee
      });
      
      // Update balances and pool
      // ... balance update ops
    } else if (hop.type === 'hop2') {
      // Swap to destination token
      // Similar logic but reversed
    }
  }
  
  if (currentAmount < minAmountOut) {
    return { 
      success: false, 
      reason: 'Slippage too high',
      wouldReceive: currentAmount,
      minRequired: minAmountOut
    };
  }
  
  return {
    success: true,
    amountOut: currentAmount,
    route,
    swapDetails
  };
};