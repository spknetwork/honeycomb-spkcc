# MSHeld.VALUE Implementation

## Overview
Added automatic calculation and update of `stats.MSHeld.VALUE` which tracks the total USD value of multisig holdings in millidollars (integer).

## Calculation Formula
```javascript
MSHeld.VALUE = MSHeld.HBD + (MSHeld.HIVE * stats.priceFeed.hivePrice)
```

Where:
- `MSHeld.HBD` is in millihbd (1 HBD = 1000 millihbd = 1000 millidollars)
- `MSHeld.HIVE` is in millihive (1 HIVE = 1000 millihive)
- `stats.priceFeed.hivePrice` is HIVE price in USD (e.g., "0.2170")
- Result is stored as integer millidollars

## Implementation Details

### Helper Function
```javascript
const updateMSHeldValue = (stats) => {
  if (!stats.MSHeld) stats.MSHeld = { HIVE: 0, HBD: 0, VALUE: 0 };
  if (!stats.priceFeed) stats.priceFeed = { hivePrice: "0.2170", hivePerHbd: "4.6080" };
  
  const hbdValue = stats.MSHeld.HBD || 0;
  const hiveValue = (stats.MSHeld.HIVE || 0) * parseFloat(stats.priceFeed.hivePrice || 0.217);
  
  stats.MSHeld.VALUE = Math.floor(hbdValue + hiveValue);
  
  return stats.MSHeld.VALUE;
};
```

### Update Locations

1. **When MSHeld amounts increase:**
   - NFT purchases (`stats.MSHeld[type] += refund_amount`)
   - NFT trades (`stats.MSHeld[type] += parseInt(json.amount.amount)`)
   - NFT bids (`stats.MSHeld[type] += parseInt(json.amount.amount)`)
   - NFT buys (`stats.MSHeld[type] += amount`)
   - DEX buy orders (`stats.MSHeld[type] += parseInt(json.amount.amount)`)

2. **When MSHeld amounts decrease:**
   - Multisig transfers out (`stats.MSHeld[type] -= parseInt(json.amount.amount)`)

3. **In margins function:**
   - After adjusting for pending transfers (msa/mss)

4. **When price feed updates:**
   - In `feed_publish` after calculating new median prices

## Example Values

With:
- HIVE price: $0.217
- HBD price: $1.00 (pegged)
- Holdings: 10,000 HIVE + 5,000 HBD

Calculation:
```
VALUE = 5,000 + (10,000 * 0.217)
VALUE = 5,000 + 2,170
VALUE = 7,170 millidollars ($7.17 USD)
```

## Benefits

1. **Quick Valuation**: Instant USD value of multisig holdings
2. **Collateral Monitoring**: Easy comparison against safety limits
3. **Price-Aware**: Updates automatically with price feed changes
4. **Integer Storage**: No floating-point precision issues