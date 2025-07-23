import { Config } from "../index.mjs"

/**
 * Update MSHeld.VALUE based on current holdings and prices
 * @param {object} stats - Stats object containing MSHeld and priceFeed
 * @returns {number} The calculated value in millidollars
 */
export const updateMSHeldValue = (stats) => {
  if (!stats.MSHeld) stats.MSHeld = { HIVE: 0, HBD: 0, VALUE: 0 };
  if (!stats.priceFeed) stats.priceFeed = { 
    hivePrice: "0.217", 
    hivePerHbd: "4.608" 
  };

  // Calculate value in millidollars
  const hbdValue = stats.MSHeld.HBD || 0;
  const hiveValue = (stats.MSHeld.HIVE || 0) * parseFloat(stats.priceFeed.hivePrice || 0.217);

  stats.MSHeld.VALUE = Math.floor(hbdValue + hiveValue);
  return stats.MSHeld.VALUE;
};

/**
 * Build split transfers for distribution
 * @param {number} amount - Total amount to distribute
 * @param {string} type - Currency type (HIVE/HBD)
 * @param {string} distribution - Distribution string
 * @param {string} memo - Transfer memo
 * @returns {array} Array of transfer operations
 */
export const buildSplitTransfers = (amount, type, distribution, memo) => {
  const transfers = [];
  const tos = distribution.split(",");
  let total = 0;
  
  for (let i = tos.length - 1; i >= 0; i--) {
    let dis = parseInt((amount * parseInt(tos[i].split("_")[1])) / 10000);
    if (!i) dis = amount - total;
    total += dis;
    
    transfers.push([
      "transfer",
      {
        to: tos[i].split("_")[0],
        from: Config("msaccount"),
        amount: `${parseFloat(dis / 1000).toFixed(3)} ${type.toUpperCase()}`,
        memo: memo + (i > 0 ? "revenue." : "creator royalty."),
      },
    ]);
  }
  
  return transfers;
};

/**
 * Normalize transaction data
 * @param {object} json - Transaction object
 * @returns {object} Normalized transaction
 */
export const naizer = (json) => {
  if (typeof json.amount == "string") {
    json.amount = {
      amount: parseInt(parseFloat(json.amount) * 1000),
      nai: json.amount.split(" ")[1] == "HIVE" ? "@@000000021" : "@@000000013",
    };
  }
  return json;
};

/**
 * Enforce NFT restrictions
 * @param {string} enforcementString - Enforcement configuration string
 * @returns {object} Enforcement rules
 */
export const enforce = (enforcementString) => {
  const enf = {};
  if (!enforcementString) return enf;
  
  const rules = enforcementString.split(",");
  for (const rule of rules) {
    const [key, value] = rule.split(":");
    if (key === "max") enf.max = parseInt(value);
    if (key === "pb") enf.pb = value;
  }
  
  return enf;
};

/**
 * Post verification
 * @param {string} postBody - Post body for verification
 * @param {string} from - User making the request
 * @param {string} itemId - Item identifier
 * @param {string} type - Type of verification
 */
export const postVerify = (postBody, from, itemId, type) => {
  // Implementation would go here
  console.log(`Post verification for ${from} on ${itemId} of type ${type}`);
};

/**
 * Calculate maximum allowed based on collateral
 * @param {object} stats - Stats object
 * @param {string} tick - Current price tick
 * @param {number} amount - Requested amount
 * @param {string} rate - Exchange rate
 * @returns {number} Amount to refund
 */
export const maxAllowed = (stats, tick, amount, rate) => {
  // Simple implementation - would need actual collateral calculation
  return 0;
};

/**
 * Initialize LP pool if not already initialized
 * @param {object} dex - DEX object
 * @returns {object} DEX object with initialized pool
 */
export const initializeLpPool = (dex) => {
  if (!dex.pool) {
    dex.pool = {
      token: 0,
      hive: 0,
      hbd: 0,
      k: 0
    };
  }
  return dex;
};

/**
 * Calculate curve price based on pool reserves
 * @param {number} tokenReserve - Token reserve in pool
 * @param {number} currencyReserve - Currency reserve in pool
 * @returns {string} Price per token
 */
export const calculateCurvePrice = (tokenReserve, currencyReserve) => {
  if (!tokenReserve || !currencyReserve) return "0";
  return (currencyReserve / tokenReserve).toFixed(6);
};

/**
 * Execute LP swap
 * @param {number} amountIn - Amount to swap
 * @param {string} pair - Trading pair (hive/hbd)
 * @param {object} dex - DEX object
 * @param {object} stats - Stats object
 * @returns {object} Swap result
 */
export const executeLpSwap = (amountIn, pair, dex, stats) => {
  const result = {
    success: false,
    amountOut: 0,
    newTick: dex.tick
  };

  if (!dex.pool || dex.pool.token <= 0 || dex.pool[pair] <= 0) {
    return result;
  }

  // Simple constant product formula: x * y = k
  const k = dex.pool.token * dex.pool[pair];
  const newCurrencyReserve = dex.pool[pair] + amountIn;
  const newTokenReserve = k / newCurrencyReserve;
  const tokenOut = dex.pool.token - newTokenReserve;

  // Apply fee (default 0.5%)
  const fee = parseFloat(stats.dex_fee) || 0.005;
  const tokenOutAfterFee = tokenOut * (1 - fee);

  if (tokenOutAfterFee > 0 && tokenOutAfterFee < dex.pool.token * 0.1) {
    // Limit to 10% of pool
    dex.pool[pair] = newCurrencyReserve;
    dex.pool.token = newTokenReserve;
    
    result.success = true;
    result.amountOut = Math.floor(tokenOutAfterFee);
    result.newTick = calculateCurvePrice(dex.pool.token, dex.pool[pair]);
  }

  return result;
};