import { store, Config } from "../index.mjs"
import { getPathObj, getPathNum } from "../getPathObj.js"
import { postToDiscord } from "../discord.js"
import stringify from "json-stable-stringify"
import { naizer, updateMSHeldValue } from "./dex_utils.js"
import {
  handleNFTPurchase,
  handleNFTTrade,
  handleNFTBid,
  handleNFTBuy,
  handleDEXTrade
} from "./dex_handlers.js"

/**
 * Refactored transfer function with modular handlers
 * @param {object} json - Transaction data
 * @param {array} pc - Promise chain
 */
export const transfer = (json, pc) => {
  json = naizer(json);
  
  // Check if DEX or NFT features are enabled and transaction is to the multisig account
  if (!(Config("features").dex || Config("features").nft) || json.to !== Config("msaccount")) {
    // Handle transfers from multisig account
    if (Config("features").dex && json.from === Config("msaccount")) {
      return handleMultisigTransfer(json, pc);
    }
    return;
  }

  // Parse memo to determine transaction type
  const memoWords = json.memo.split(" ");
  if (memoWords.length <= 1) {
    // Regular DEX trade
    return handleDEXTrade(json, pc);
  }

  const transactionType = memoWords[0];
  const item = memoWords[1];

  switch (transactionType) {
    case "NFT":
      return handleNFTTransaction(json, pc, item);
    
    case "NFTtrade":
      return handleNFTTradeTransaction(json, pc, item);
    
    case "NFTbid":
      return handleNFTBidTransaction(json, pc, item);
    
    case "NFTbuy":
      return handleNFTBuyTransaction(json, pc, item);
    
    default:
      // Default to DEX trade
      return handleDEXTrade(json, pc);
  }
};

/**
 * Handle NFT purchase transactions
 */
const handleNFTTransaction = (json, pc, item) => {
  const setname = item.split(":")[0];
  return handleNFTPurchase(json, pc, { item, setname });
};

/**
 * Handle NFT trade transactions
 */
const handleNFTTradeTransaction = (json, pc, item) => {
  const setname = item.split(":")[0];
  const uid = item.split(":")[1];
  return handleNFTTrade(json, pc, { item, setname, uid });
};

/**
 * Handle NFT bid transactions
 */
const handleNFTBidTransaction = (json, pc, item) => {
  const set = item.split(":")[0];
  const uid = item.split(":")[1];
  return handleNFTBid(json, pc, { item, set, uid });
};

/**
 * Handle NFT buy transactions
 */
const handleNFTBuyTransaction = (json, pc, item) => {
  const setname = item.split(":")[0];
  const uid = item.split(":")[1];
  return handleNFTBuy(json, pc, { item, setname, uid });
};

/**
 * Handle transfers from the multisig account
 */
const handleMultisigTransfer = async (json, pc) => {
  const [mss, stats] = await Promise.all([
    getPathObj(["mss"]),
    getPathObj(["stats"])
  ]);

  const type = json.amount.nai == "@@000000021" ? "HIVE" : "HBD";
  stats.MSHeld[type] -= parseInt(json.amount.amount);
  updateMSHeldValue(stats);

  const ops = [];
  let deleteOp = false;

  // Find and process matching signatures
  for (const [key, value] of Object.entries(mss)) {
    if (value) {
      const sig_to = value.split(":")[1];
      const sig_amount = parseInt(value.split(":")[2]);
      const sig_memo = decodeURIComponent(value.split(":")[3]) || "";
      const sig_id = value.split(":")[4] || "";
      const sig_type = value.split(":")[5];

      if (
        sig_to === json.to &&
        sig_amount === parseInt(json.amount.amount) &&
        sig_memo === json.memo &&
        sig_type === type
      ) {
        deleteOp = true;
        ops.push({ type: "del", path: ["mss", key] });
        
        const msg = `@${json.from} | Sent ${json.amount} to ${json.to} | memo: ${json.memo.substr(0, 100)}`;
        if (Config("hookurl") || Config("status"))
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        
        break;
      }
    }
  }

  if (deleteOp) {
    ops.push({ type: "put", path: ["stats"], data: stats });
    
    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
    store.batch(ops, pc);
  }
};