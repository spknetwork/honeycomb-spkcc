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
import { 
  updateMSHeldValue, 
  buildSplitTransfers,
  naizer,
  enforce,
  postVerify,
  maxAllowed,
  initializeLpPool,
  calculateCurvePrice,
  executeLpSwap
} from "./dex_utils.js"

/**
 * Get token DEX configuration
 * This function determines the paths based on the token being traded
 * @param {string} token - Token identifier from order
 * @param {object} config - Configuration object
 * @returns {object} Token-specific configuration
 */
const getTokenDexConfig = (token, config) => {
  // Default configuration for the main token
  const defaultConfig = {
    dexPath: 'dex',
    balancePath: 'balances',
    totalPath: ['balances', 't'],
    symbol: token || config.TOKEN || 'TOKEN',
    precision: config.precision || 3
  };

  // Check if there's a custom token configuration
  // This allows for different storage paths based on token suffix or prefix
  if (token && token !== config.TOKEN) {
    // Determine suffix based on token name or configuration
    let suffix = '';
    
    // Check if there's a token mapping in config
    if (config.tokenDexMap && config.tokenDexMap[token]) {
      return config.tokenDexMap[token];
    }
    
    // Otherwise, use a convention-based approach
    // For example: SPK -> dexs, BROCA -> dexb
    if (token.length <= 5) {
      suffix = token.toLowerCase().charAt(0);
    }
    
    return {
      dexPath: `dex${suffix}`,
      balancePath: config.tokenBalanceMap?.[token] || token.toLowerCase(),
      totalPath: [config.tokenBalanceMap?.[token] || token.toLowerCase(), 't'],
      symbol: token,
      precision: config.precision || 3
    };
  }
  
  return defaultConfig;
};

/**
 * Add balance for any token type
 * @param {string} node - Account to credit
 * @param {number} amount - Amount to add
 * @param {object} tokenConfig - Token configuration
 * @param {object} context - Execution context
 */
const addTokenBalance = (node, amount, tokenConfig, context) => {
  const { store } = context;
  return new Promise((resolve, reject) => {
    store.get([tokenConfig.balancePath, node], function (e, a) {
      if (!e) {
        const a2 = typeof a != 'number' ? amount : a + amount;
        store.batch([{ type: 'put', path: [tokenConfig.balancePath, node], data: a2 }], [resolve, reject, 1]);
      } else {
        console.log(e);
        reject(e);
      }
    });
  });
};

/**
 * Handle DEX trading operations for any token
 * @param {object} json - Transaction data
 * @param {array} pc - Promise chain
 * @param {object} context - Execution context with utilities
 */
export const handleDEXTrade = async (json, pc, context) => {
  const { store, config, getPathObj, getPathNum } = context;
  
  let order = {
    type: "LIMIT",
    token: config.TOKEN // Default to main token
  };
  
  try {
    order = JSON.parse(json.memo);
  } catch (e) {
    // Default to LIMIT order with main token
  }

  // Set default token if not specified
  if (!order.token) {
    order.token = config.TOKEN;
  }

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

  if (order.type !== "MARKET" && order.type !== "LIMIT") {
    return handleInvalidDEXOrder(json, pc, context);
  }

  // Get token configuration dynamically
  const tokenConfig = getTokenDexConfig(order.token, config);
  
  // Fetch required data with dynamic paths
  const promises = [
    getPathObj([tokenConfig.dexPath, order.pair]),
    getPathNum([tokenConfig.balancePath, json.from]),
    getPathNum(["balances", "ri"]), // Inventory always from main balance
    getPathObj(["stats"])
  ];
  
  // Add governance token tick if needed for special calculations
  if (config.govToken && order.token === config.govToken) {
    promises.push(getPathObj([getTokenDexConfig(config.govToken, config).dexPath, "hive", "tick"]));
  }
  
  const results = await Promise.all(promises);
  const [dex, bal, inv, stats, govTick] = results;

  await processDEXOrder(json, pc, { 
    order, 
    dex, 
    bal, 
    inv, 
    stats, 
    govTick, 
    tokenConfig,
    context 
  });
};

/**
 * Process DEX order for any token type
 */
const processDEXOrder = async (json, pc, params) => {
  const { order, dex, bal, inv, stats, govTick, tokenConfig, context } = params;
  const { store, config, DEX, postToDiscord, chronAssign, add, getPathNum } = context;
  
  let filled = 0;
  let remaining = order.amount;
  const ops = [];
  const his = {};
  let fee = 0;
  let i = 0;
  let clawback = 0;

  // Initialize DEX if needed
  if (!dex.tick) dex.tick = "1.000000";
  
  if (typeof order.rate !== "string") order.rate = dex.tick;
  
  // Update any token-specific calculations (like collateral value)
  if (config.tokenSpecificCalcs && config.tokenSpecificCalcs[order.token]) {
    config.tokenSpecificCalcs[order.token](stats, dex.tick);
  }
  
  // Update MSHeld
  stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] += parseInt(json.amount.amount);
  updateMSHeldValue(stats);

  while (remaining) {
    i++;
    
    // Initialize LP pool if needed
    initializeLpPool(dex);

    // Get order book price
    let price = dex.sellBook ? parseFloat(dex.sellBook.split("_")[0]).toFixed(6) : "";
    let item = "";
    
    if (price) {
      item = dex.sellBook.split("_")[1].split(",")[0];
    } else {
      price = dex.tick;
    }

    // Update any token-specific calculations
    if (config.tokenSpecificCalcs && config.tokenSpecificCalcs[order.token]) {
      config.tokenSpecificCalcs[order.token](stats, dex.tick);
    }

    // Check if we should match against order book
    const shouldMatch = item && 
      (order.pair === "hbd" || 
       (order.pair === "hive" && 
        (!config.tokenRestrictions || 
         !config.tokenRestrictions[order.token] || 
         config.tokenRestrictions[order.token](price, stats, config)))) &&
      (order.type === "MARKET" || 
       (order.type === "LIMIT" && parseFloat(order.rate) >= parseFloat(price)));

    if (shouldMatch) {
      const next = dex.sellOrders?.[`${price}:${item}`];
      
      if (next && next[order.pair] <= remaining) {
        // Process full fill
        await processFullFill(next, { 
          remaining, filled, bal, fee, dex, his, ops, i, clawback, 
          order, json, item, price, tokenConfig, stats, context 
        });
        
        filled = params.filled;
        bal = params.bal;
        fee = params.fee;
        remaining = params.remaining;
        clawback = params.clawback;
      } else if (next) {
        // Process partial fill
        const result = await processPartialFill(next, {
          remaining, filled, bal, fee, dex, his, ops, i, clawback,
          order, json, item, price, tokenConfig, stats, context
        });
        
        filled = result.filled;
        bal = result.bal;
        fee = result.fee;
        remaining = 0; // Partial fill consumes all remaining
        clawback = result.clawback;
      }
    } else {
      // Try LP swap or create limit order
      const result = await processLimitOrderOrSwap({
        remaining, filled, bal, dex, his, ops, i,
        order, json, tokenConfig, stats, context
      });
      
      if (result.completed) {
        filled = result.filled;
        bal = result.bal;
        fee = result.fee;
        remaining = result.remaining;
      }
    }
  }

  // Process fees based on token configuration
  await processFees(fee, filled, order, json, bal, ops, i, tokenConfig, stats, context);

  // Apply any token-specific clawback
  if (clawback > 0 && config.tokenClawback && config.tokenClawback[order.token]) {
    await config.tokenClawback[order.token](clawback, ops, context);
  }

  // Final operations
  ops.push({ type: "put", path: [tokenConfig.balancePath, json.from], data: bal });
  
  if (Object.keys(his).length) {
    ops.push({
      type: "put",
      path: [tokenConfig.dexPath, order.pair, "his"],
      data: his,
    });
  }
  
  ops.push({ type: "put", path: [tokenConfig.dexPath, order.pair], data: dex });
  ops.push({ type: "put", path: ["stats"], data: stats });
  
  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
  store.batch(ops, pc);
};

/**
 * Process full fill helper
 */
const processFullFill = async (next, params) => {
  const { order, tokenConfig, stats, context } = params;
  const { config, DEX, stringify } = context;
  
  // Apply any token-specific adjustments (like clawback)
  if (config.tokenAdjustments && config.tokenAdjustments[order.token]) {
    const adjustment = config.tokenAdjustments[order.token](next, params);
    params.clawback += adjustment.clawback || 0;
    next.amount = adjustment.amount || next.amount;
  }
  
  params.filled += next.amount - next.fee;
  params.bal += next.amount - next.fee;
  params.fee += next.fee;
  params.remaining -= next[order.pair];
  params.dex.tick = next.rate;
  
  // Update any token-specific calculations
  if (config.tokenSpecificCalcs && config.tokenSpecificCalcs[order.token]) {
    config.tokenSpecificCalcs[order.token](stats, params.dex.tick);
  }
  
  // Record history
  params.his[`${params.json.block_num}:${params.i}:${params.json.transaction_id}`] = {
    type: "buy",
    t: Date.parse(params.json.timestamp),
    block: params.json.block_num,
    base_vol: next.amount,
    target_vol: next[order.pair],
    target: order.pair,
    price: next.rate,
    id: params.json.transaction_id + params.i,
  };
  
  // Update order book
  params.dex.sellBook = DEX.remove(params.item, params.dex.sellBook);
  delete params.dex.sellOrders[`${params.price}:${params.item}`];
  
  // Create transfer
  const transfer = [
    "transfer",
    {
      from: config.msaccount,
      to: next.from,
      amount: parseFloat(next[order.pair] / 1000).toFixed(3) + " " + order.pair.toUpperCase(),
      memo: `Filled ${params.item}:${params.json.transaction_id}`,
    },
  ];
  
  // Create message
  const msg = `@${params.json.from} bought ${parseFloat(parseInt(next.amount) / 1000).toFixed(3)} ${order.token} with ${parseFloat(parseInt(next[order.pair]) / 1000).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from} (${params.item})`;
  
  // Add operations
  params.ops.push({
    type: "put",
    path: ["feed", `${params.json.block_num}:${params.json.transaction_id}.${params.i}`],
    data: msg,
  });
  
  params.ops.push({
    type: "put",
    path: ["msa", `${params.item}:${params.json.transaction_id}:${params.i}`],
    data: stringify(transfer),
  });
  
  params.ops.push({
    type: "del",
    path: [tokenConfig.dexPath, order.pair, "sellOrders", `${params.price}:${params.item}`],
  });
  
  params.ops.push({
    type: "del",
    path: ["contracts", next.from, params.item],
  });
  
  params.ops.push({
    type: "del",
    path: ["chrono", next.expire_path],
  });
};

/**
 * Process partial fill helper
 */
const processPartialFill = async (next, params) => {
  const { order, tokenConfig, stats, context } = params;
  const { config, stringify } = context;
  
  // Apply any token-specific adjustments
  if (config.tokenAdjustments && config.tokenAdjustments[order.token]) {
    const adjustment = config.tokenAdjustments[order.token](next, params);
    params.clawback += adjustment.clawback || 0;
    next.amount = adjustment.amount || next.amount;
  }
  
  next[order.pair] = next[order.pair] - params.remaining;
  const tokenAmount = parseInt(params.remaining / parseFloat(next.rate));
  const feeAmount = parseInt((tokenAmount / next.amount) * next.fee);
  
  params.filled += tokenAmount - feeAmount;
  params.bal += tokenAmount - feeAmount;
  params.fee += feeAmount;
  next.amount -= tokenAmount;
  next.fee -= feeAmount;
  
  // Record history
  params.his[`${params.json.block_num}:${params.i}:${params.json.transaction_id}`] = {
    type: "buy",
    t: Date.parse(params.json.timestamp),
    block: params.json.block_num,
    base_vol: tokenAmount,
    target_vol: params.remaining,
    target: order.pair,
    price: next.rate,
    id: params.json.transaction_id + params.i,
  };
  
  // Track partial fills
  if (!next.partial) {
    next.partial = {};
  }
  next.partial[params.json.transaction_id] = {
    token: tokenAmount,
    coin: params.remaining,
  };
  
  params.dex.tick = next.rate;
  
  // Update any token-specific calculations
  if (config.tokenSpecificCalcs && config.tokenSpecificCalcs[order.token]) {
    config.tokenSpecificCalcs[order.token](stats, params.dex.tick);
  }
  
  params.dex.sellOrders[`${params.price}:${params.item}`] = next;
  
  // Create transfer and operations
  const transfer = [
    "transfer",
    {
      from: config.msaccount,
      to: next.from,
      amount: parseFloat(params.remaining / 1000).toFixed(3) + " " + order.pair.toUpperCase(),
      memo: `Partial Filled ${params.item}:${params.json.transaction_id}`,
    },
  ];
  
  const msg = `@${params.json.from} bought ${parseFloat(parseInt(tokenAmount) / 1000).toFixed(3)} ${order.token} with ${parseFloat(parseInt(params.remaining) / 1000).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from} (${params.item})`;
  
  params.ops.push({
    type: "put",
    path: ["feed", `${params.json.block_num}:${params.json.transaction_id}.${params.i}`],
    data: msg,
  });
  
  params.ops.push({
    type: "put",
    path: [tokenConfig.balancePath, params.json.from],
    data: params.bal,
  });
  
  params.ops.push({
    type: "put",
    path: ["msa", `${params.item}:${params.json.transaction_id}:${params.i}`],
    data: stringify(transfer),
  });
  
  params.ops.push({
    type: "put",
    path: ["contracts", next.from, params.item],
    data: next,
  });
  
  return params;
};

/**
 * Process limit order or LP swap
 */
const processLimitOrderOrSwap = async (params) => {
  const { dex, order, json, tokenConfig, stats, context } = params;
  const { config, hashThis, chronAssign, stringify, DEX } = context;
  
  // Try LP swap if available
  if (dex.pool && dex.pool.token > 0 && dex.pool[order.pair] > 0) {
    const swapResult = executeLpSwap(params.remaining, order.pair, dex, stats);
    
    if (swapResult.success && swapResult.amountOut > 0) {
      params.filled += swapResult.amountOut;
      params.bal += swapResult.amountOut;
      dex.tick = swapResult.newTick;
      
      // Record history
      params.his[`${json.block_num}:${params.i}:${json.transaction_id}`] = {
        type: "buy",
        t: Date.parse(json.timestamp),
        block: json.block_num,
        base_vol: swapResult.amountOut,
        target_vol: params.remaining,
        target: order.pair,
        price: swapResult.newTick,
        id: json.transaction_id + params.i,
      };
      
      const msg = `@${json.from} bought ${parseFloat(parseInt(swapResult.amountOut) / 1000).toFixed(3)} ${order.token} with ${parseFloat(parseInt(params.remaining) / 1000).toFixed(3)} ${order.pair.toUpperCase()} via LP swap`;
      
      params.ops.push({
        type: "put",
        path: ["feed", `${json.block_num}:${json.transaction_id}.${params.i}`],
        data: msg,
      });
      
      // Calculate fees
      const lpFee = parseInt(swapResult.amountOut * (parseFloat(stats.dex_fee) || 0.005));
      params.fee += lpFee;
      params.bal -= lpFee;
      
      return { ...params, remaining: 0, completed: true };
    }
  }
  
  // Create limit order
  const txid = order.token + hashThis(json.from + json.transaction_id);
  const crate = parseFloat(order.rate) > 0 ? order.rate : dex.tick;
  const toRefund = maxAllowed(stats, dex.tick, params.remaining, crate);
  params.remaining = params.remaining - toRefund;
  
  const hours = 720;
  const expBlock = json.block_num + hours * 1200;
  
  if (toRefund) {
    const transfer = [
      "transfer",
      {
        from: config.msaccount,
        to: json.from,
        amount: parseFloat(toRefund / 1000).toFixed(3) + " " + order.pair.toUpperCase(),
        memo: `Partial refund due to collateral limits ${json.from}:${json.transaction_id}`,
      },
    ];
    params.ops.push({
      type: "put",
      path: ["msa", `Refund@${json.from}:${json.transaction_id}:${json.block_num}`],
      data: stringify(transfer),
    });
  }
  
  const contract = {
    txid,
    from: json.from,
    hive: 0,
    hbd: 0,
    fee: 0,
    amount: 0,
    rate: crate,
    block: json.block_num,
    type: `${order.pair}:buy`,
    token: order.token,
    hive_id: json.transaction_id,
  };
  
  contract.amount = parseInt(params.remaining / parseFloat(crate));
  contract.fee = parseFloat(stats.dex_fee) > 0
    ? parseInt(parseInt(contract.amount) * parseFloat(stats.dex_fee)) + 1
    : parseInt(contract.amount * 0.005) + 1;
  contract[order.pair] = params.remaining;
  
  if (params.remaining) {
    dex.buyBook = DEX.insert(txid, crate, dex.buyBook, "buy");
    const path = await chronAssign(expBlock, {
      block: expBlock,
      op: "expire",
      from: json.from,
      txid,
    });
    contract.expire_path = path;
    
    if (!dex.buyOrders) dex.buyOrders = {};
    dex.buyOrders[`${contract.rate}:${contract.txid}`] = contract;
    
    params.ops.push({
      type: "put",
      path: ["contracts", json.from, contract.txid],
      data: contract,
    });
    
    const msg = `@${json.from} is buying ${parseFloat(parseInt(contract.amount) / 1000).toFixed(3)} ${order.token} for ${parseFloat(parseInt(contract[order.pair]) / 1000).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid})`;
    
    params.ops.push({
      type: "put",
      path: ["feed", `${json.block_num}:${json.transaction_id}.${params.i}`],
      data: msg,
    });
  }
  
  return { ...params, remaining: 0, completed: true };
};

/**
 * Process fees based on token configuration
 */
const processFees = async (fee, filled, order, json, bal, ops, i, tokenConfig, stats, context) => {
  const { config, postToDiscord } = context;
  
  let msg = "";
  if (filled === 0) {
    msg = `@${json.from} set a buy order at ${order.rate}.`;
  } else if (json.from !== "rn") {
    msg = `@${json.from} | order received.`;
    if (fee > 0) {
      // Handle fees based on token configuration
      if (config.tokenFeeHandlers && config.tokenFeeHandlers[order.token]) {
        await config.tokenFeeHandlers[order.token](fee, context);
      } else {
        // Default fee handling
        await addTokenBalance('u', fee, tokenConfig, context);
      }
    }
  } else {
    msg = `@${json.from} | order received.`;
    bal += fee;
  }

  if (config.hookurl || config.status) {
    postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
  }

  ops.push({
    type: "put",
    path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
    data: msg,
  });
};

/**
 * Handle invalid DEX order
 */
const handleInvalidDEXOrder = (json, pc, context) => {
  const { store, config, getPathObj, stringify } = context;
  
  const transfer = [
    "transfer",
    {
      from: config.msaccount,
      to: json.from,
      amount: json.amount,
      memo: `This doesn't appear to be formatted correctly to buy tokens`,
    },
  ];
  
  const ops = [];
  const msg = `@${json.from} sent a weird transaction to ${config.msaccount}: refunding`;
  
  ops.push({
    type: "put",
    path: ["feed", `${json.block_num}:${json.transaction_id}`],
    data: msg,
  });
  
  ops.push({
    type: "put",
    path: ["msa", `refund@${json.from}:${json.transaction_id}:${json.block_num}`],
    data: stringify(transfer),
  });
  
  getPathObj(["stats"]).then(stats => {
    ops.push({ type: "put", path: ["stats"], data: stats });
    
    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
    store.batch(ops, pc);
  });
};