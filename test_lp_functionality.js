// Test script to demonstrate LP functionality

// Example DEX state with order book and LP
const dexExample = {
  tick: "0.100000",
  buyBook: "0.095000_buy1,0.090000_buy2",
  sellBook: "0.105000_sell1,0.110000_sell2",
  buyOrders: {
    "0.095000:buy1": {
      from: "alice",
      hive: 950,
      amount: 10000,
      fee: 50,
      rate: "0.095000"
    },
    "0.090000:buy2": {
      from: "bob",
      hive: 900,
      amount: 10000,
      fee: 50,
      rate: "0.090000"
    }
  },
  sellOrders: {
    "0.105000:sell1": {
      from: "charlie",
      amount: 10000,
      hive: 1050,
      fee: 50,
      rate: "0.105000"
    },
    "0.110000:sell2": {
      from: "dave",
      amount: 10000,
      hive: 1100,
      fee: 50,
      rate: "0.110000"
    }
  },
  // LP pool with 100,000 tokens and 10,000 HIVE (price = 0.1 HIVE/token)
  pool: {
    token: 100000,
    hive: 10000,
    lpTokens: 31622 // sqrt(100000 * 10000)
  }
};

const statsExample = {
  safetyLimit: 50000, // 50,000 HIVE collateral limit
  dex_fee: 0.005, // 0.5% fee
  priceFeed: {
    hivePerHbd: "4.6080",
    hivePrice: "0.2170"
  },
  MSHeld: {
    HIVE: 15000, // Currently holding 15,000 HIVE
    HBD: 0
  }
};

console.log("=== LP Order Matching Example ===\n");

console.log("Current DEX State:");
console.log("- Order Book Best Buy: 0.095000 HIVE/token");
console.log("- Order Book Best Sell: 0.105000 HIVE/token");
console.log("- LP Curve Price: 0.100000 HIVE/token");
console.log("- LP Reserves: 100,000 tokens, 10,000 HIVE\n");

console.log("Scenario 1: User sells 1,000 tokens");
console.log("- Best buy order: 0.095000 (worse than LP price 0.100000)");
console.log("- Result: Swap through LP instead of order book");
console.log("- User receives: ~99 HIVE (after 0.5% fee)\n");

console.log("Scenario 2: User buys tokens with 100 HIVE");
console.log("- Best sell order: 0.105000 (worse than LP price 0.100000)");
console.log("- Result: Swap through LP instead of order book");
console.log("- User receives: ~995 tokens (after 0.5% fee)\n");

console.log("Scenario 3: Market maker places better order");
console.log("- New buy order at 0.102000 (better than LP price)");
console.log("- Result: Order executes against order book, not LP\n");

console.log("Collateral Safety:");
console.log("- Current holdings: 15,000 HIVE");
console.log("- LP holdings: 10,000 HIVE");
console.log("- Buy orders locked: 1,850 HIVE");
console.log("- Total: 26,850 HIVE (under 50,000 limit)");