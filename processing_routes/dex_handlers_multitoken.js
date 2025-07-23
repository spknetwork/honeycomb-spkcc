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
 * Token configuration for multi-token DEX
 */
const TOKEN_CONFIG = {
  LARYNX: {
    dexPath: 'dex',
    balancePath: 'balances',
    totalPath: ['balances', 't'],
    symbol: 'LARYNX',
    precision: 3
  },
  SPK: {
    dexPath: 'dexs',
    balancePath: 'spk',
    totalPath: ['spk', 't'],
    symbol: 'SPK',
    precision: 3
  },
  BROCA: {
    dexPath: 'dexb',
    balancePath: 'lbroca',
    totalPath: ['lbroca', 't'],
    symbol: 'BROCA',
    precision: 3
  }
};

/**
 * Helper functions for multi-token support
 */
const getTokenConfig = (token) => {
  return TOKEN_CONFIG[token] || TOKEN_CONFIG.LARYNX;
};

const addTokenBalance = (node, amount, token) => {
  const config = getTokenConfig(token);
  return new Promise((resolve, reject) => {
    store.get([config.balancePath, node], function (e, a) {
      if (!e) {
        const a2 = typeof a != 'number' ? amount : a + amount;
        store.batch([{ type: 'put', path: [config.balancePath, node], data: a2 }], [resolve, reject, 1]);
      } else {
        console.log(e);
        reject(e);
      }
    });
  });
};

const burnTokenBalance = (node, amount = 0, token) => {
  const config = getTokenConfig(token);
  return new Promise((resolve, reject) => {
    store.get(config.totalPath, function (e, a) {
      if (!e) {
        const a2 = typeof a != 'number' ? amount : a - amount;
        store.batch([{ type: 'put', path: [config.balancePath, node], data: a2 }], [resolve, reject, 1]);
      } else {
        console.log(e);
        reject(e);
      }
    });
  });
};

/**
 * Handle multi-token DEX trading operations
 * @param {object} json - Transaction data
 * @param {array} pc - Promise chain
 */
export const handleMultiTokenDEXTrade = async (json, pc) => {
  let order = {
    type: "LIMIT",
    token: "LARYNX" // Default token
  };
  
  try {
    order = JSON.parse(json.memo);
  } catch (e) {
    // Default to LIMIT order with LARYNX token
  }

  // Validate token
  if (!(order.token === 'SPK' || order.token === 'BROCA' || order.token === 'LARYNX')) {
    order.token = 'LARYNX';
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
    return handleInvalidDEXOrder(json, pc);
  }

  const tokenConfig = getTokenConfig(order.token);
  
  const [dex, bal, inv, stats, govTick] = await Promise.all([
    getPathObj([tokenConfig.dexPath, order.pair]),
    getPathNum([tokenConfig.balancePath, json.from]),
    getPathNum(["balances", "ri"]),
    getPathObj(["stats"]),
    getPathObj(["dexs", "hive", "tick"]) // For SPK price reference
  ]);

  await processMultiTokenDEXOrder(json, pc, { order, dex, bal, inv, stats, govTick, tokenConfig });
};

/**
 * Process multi-token DEX order
 */
const processMultiTokenDEXOrder = async (json, pc, { order, dex, bal, inv, stats, govTick, tokenConfig }) => {
  let filled = 0;
  let remaining = order.amount;
  const ops = [];
  const his = {};
  let fee = 0;
  let i = 0;
  let clawback = 0;

  // Initialize DEX if needed
  if (!dex.tick) dex.tick = "1.000000";
  if (!govTick) govTick = "1.000000";
  
  if (typeof order.rate !== "string") order.rate = dex.tick;
  
  // Update multisig collateral value for SPK
  if (order.token === 'SPK') {
    stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * parseFloat(dex.tick));
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

    // Update collateral value for SPK
    if (order.token === 'SPK') {
      stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * parseFloat(dex.tick));
    }

    // Check if we should match against order book
    const shouldMatch = item && 
      (order.pair === "hbd" || 
       (order.pair === "hive" && 
        (order.token === 'SPK' || order.token === 'BROCA' || parseFloat(price) <= (stats.icoPrice || 0) / 1000 || !Config("features").ico))) &&
      (order.type === "MARKET" || 
       (order.type === "LIMIT" && parseFloat(order.rate) >= parseFloat(price)));

    if (shouldMatch) {
      const next = dex.sellOrders?.[`${price}:${item}`];
      
      if (next && next[order.pair] <= remaining) {
        // Full fill
        if (next[order.pair]) {
          // Apply BROCA clawback if applicable
          if (order.token === 'BROCA' && stats.broca_clawback) {
            const newClawback = parseInt((remaining / next.amount) * stats.broca_clawback / 10000);
            clawback += newClawback;
            next.amount = Math.max(0, next.amount - newClawback);
          }
          
          filled += next.amount - next.fee;
          bal += next.amount - next.fee;
          fee += next.fee;
          remaining -= next[order.pair];
          dex.tick = next.rate;
          
          // Update collateral value for SPK
          if (order.token === 'SPK') {
            stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * parseFloat(dex.tick));
          }
          
          // Record history
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
          
          // Update order book
          dex.sellBook = DEX.remove(item, dex.sellBook);
          delete dex.sellOrders[`${price}:${item}`];
          
          // Create transfer
          const transfer = [
            "transfer",
            {
              from: Config("msaccount"),
              to: next.from,
              amount: parseFloat(next[order.pair] / 1000).toFixed(3) + " " + order.pair.toUpperCase(),
              memo: `Filled ${item}:${json.transaction_id}`,
            },
          ];
          
          // Create message
          const msg = `@${json.from} bought ${parseFloat(parseInt(next.amount) / 1000).toFixed(3)} ${order.token} with ${parseFloat(parseInt(next[order.pair]) / 1000).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from} (${item})`;
          
          // Add operations
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
            data: msg,
          });
          
          if (Object.keys(his).length) {
            ops.push({
              type: "put",
              path: [tokenConfig.dexPath, order.pair, "his"],
              data: his,
            });
          }
          
          ops.push({
            type: "put",
            path: ["msa", `${item}:${json.transaction_id}:${i}`],
            data: stringify(transfer),
          });
          
          ops.push({
            type: "del",
            path: [tokenConfig.dexPath, order.pair, "sellOrders", `${price}:${item}`],
          });
          
          ops.push({
            type: "del",
            path: ["contracts", next.from, item],
          });
          
          ops.push({
            type: "del",
            path: ["chrono", next.expire_path],
          });
        }
      } else if (next) {
        // Partial fill
        // Apply BROCA clawback if applicable
        if (order.token === 'BROCA' && stats.broca_clawback) {
          const newClawback = parseInt((remaining / next.amount) * stats.broca_clawback / 10000);
          clawback += newClawback;
          next.amount -= newClawback;
        }
        
        next[order.pair] = next[order.pair] - remaining;
        const tokenAmount = parseInt(remaining / parseFloat(next.rate));
        const feeAmount = parseInt((tokenAmount / next.amount) * next.fee);
        
        filled += tokenAmount - feeAmount;
        bal += tokenAmount - feeAmount;
        fee += feeAmount;
        next.amount -= tokenAmount;
        next.fee -= feeAmount;
        
        // Record history
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
        
        // Track partial fills
        if (!next.partial) {
          next.partial = {};
        }
        next.partial[json.transaction_id] = {
          token: tokenAmount,
          coin: remaining,
        };
        
        dex.tick = next.rate;
        
        // Update collateral value for SPK
        if (order.token === 'SPK') {
          stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * parseFloat(dex.tick));
        }
        
        dex.sellOrders[`${price}:${item}`] = next;
        
        // Create transfer
        const transfer = [
          "transfer",
          {
            from: Config("msaccount"),
            to: next.from,
            amount: parseFloat(remaining / 1000).toFixed(3) + " " + order.pair.toUpperCase(),
            memo: `Partial Filled ${item}:${json.transaction_id}`,
          },
        ];
        
        // Create message
        const msg = `@${json.from} bought ${parseFloat(parseInt(tokenAmount) / 1000).toFixed(3)} ${order.token} with ${parseFloat(parseInt(remaining) / 1000).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from} (${item})`;
        
        remaining = 0;
        
        // Add operations
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
          data: msg,
        });
        
        ops.push({
          type: "put",
          path: [tokenConfig.balancePath, json.from],
          data: bal,
        });
        
        ops.push({
          type: "put",
          path: [tokenConfig.dexPath, order.pair, "his"],
          data: his,
        });
        
        ops.push({
          type: "put",
          path: ["msa", `${item}:${json.transaction_id}:${i}`],
          data: stringify(transfer),
        });
        
        ops.push({
          type: "put",
          path: ["contracts", next.from, item],
          data: next,
        });
      }
    } else {
      // Try LP swap or create limit order
      if (dex.pool && dex.pool.token > 0 && dex.pool[order.pair] > 0) {
        // Execute LP swap
        const swapResult = executeLpSwap(remaining, order.pair, dex, stats);
        
        if (swapResult.success && swapResult.amountOut > 0) {
          filled += swapResult.amountOut;
          bal += swapResult.amountOut;
          dex.tick = swapResult.newTick;
          
          // Create history entry
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
          
          const msg = `@${json.from} bought ${parseFloat(parseInt(swapResult.amountOut) / 1000).toFixed(3)} ${order.token} with ${parseFloat(parseInt(remaining) / 1000).toFixed(3)} ${order.pair.toUpperCase()} via LP swap`;
          
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
            data: msg,
          });
          
          // Calculate and distribute fees
          const lpFee = parseInt(swapResult.amountOut * (parseFloat(stats.dex_fee) || 0.005));
          fee += lpFee;
          bal -= lpFee;
          
          remaining = 0;
          continue;
        }
      }
      
      // Create limit order
      const txid = order.token + hashThis(json.from + json.transaction_id);
      const crate = parseFloat(order.rate) > 0 ? order.rate : dex.tick;
      const toRefund = maxAllowed(stats, dex.tick, remaining, crate);
      remaining = remaining - toRefund;
      
      const hours = 720;
      const expBlock = json.block_num + hours * 1200;
      
      if (toRefund) {
        const transfer = [
          "transfer",
          {
            from: Config("msaccount"),
            to: json.from,
            amount: parseFloat(toRefund / 1000).toFixed(3) + " " + order.pair.toUpperCase(),
            memo: `Partial refund due to collateral limits ${json.from}:${json.transaction_id}`,
          },
        ];
        ops.push({
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
      
      contract.amount = parseInt(remaining / parseFloat(crate));
      contract.fee = parseFloat(stats.dex_fee) > 0
        ? parseInt(parseInt(contract.amount) * parseFloat(stats.dex_fee)) + 1
        : parseInt(contract.amount * 0.005) + 1;
      contract[order.pair] = remaining;
      
      if (remaining) {
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
        
        ops.push({
          type: "put",
          path: ["contracts", json.from, contract.txid],
          data: contract,
        });
        
        const msg = `@${json.from} is buying ${parseFloat(parseInt(contract.amount) / 1000).toFixed(3)} ${order.token} for ${parseFloat(parseInt(contract[order.pair]) / 1000).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid})`;
        
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
          data: msg,
        });
        
        remaining = 0;
      }
    }
  }

  // Process fees
  let msg = "";
  if (filled === 0) {
    msg = `@${json.from} set a buy order at ${order.rate}.`;
  } else if (json.from !== "rn") {
    msg = `@${json.from} | order received.`;
    if (fee > 0) {
      // Distribute fees based on token type
      if (order.token === 'SPK') {
        await addTokenBalance('u', fee, 'SPK'); // SPK fees go to unissued pool
      } else if (order.token === 'BROCA') {
        await addTokenBalance('u', fee, 'BROCA'); // BROCA fees go to unissued pool
      } else {
        await add("rn", fee); // LARYNX fees go to rn account
      }
    }
  } else {
    msg = `@${json.from} | order received.`;
    bal += fee;
  }

  if (Config("hookurl") || Config("status")) {
    postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
  }

  // Apply BROCA clawback to total supply
  if (clawback > 0 && order.token === 'BROCA') {
    const totalPath = getTokenConfig('BROCA').totalPath;
    const currentTotal = await getPathNum(totalPath);
    ops.push({
      type: "put",
      path: totalPath,
      data: currentTotal - clawback,
    });
  }

  // Final operations
  ops.push({ type: "put", path: [tokenConfig.balancePath, json.from], data: bal });
  ops.push({
    type: "put",
    path: ["feed", `${json.block_num}:${json.transaction_id}.${i++}`],
    data: msg,
  });
  
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
 * Handle invalid DEX order
 */
const handleInvalidDEXOrder = (json, pc) => {
  const transfer = [
    "transfer",
    {
      from: Config("msaccount"),
      to: json.from,
      amount: json.amount,
      memo: `This doesn't appear to be formatted correctly to buy tokens`,
    },
  ];
  
  const ops = [];
  const msg = `@${json.from} sent a weird transaction to ${Config("msaccount")}: refunding`;
  
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
  
  const Pstats = getPathObj(["stats"]);
  Pstats.then(stats => {
    ops.push({ type: "put", path: ["stats"], data: stats });
    
    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
    store.batch(ops, pc);
  });
};

// Export the multi-token handler as the default DEX handler
export const handleDEXTrade = handleMultiTokenDEXTrade;