# Volume EMA Implementation in dao.js

## Overview
Added Exponential Moving Average (EMA) calculations for DEX volumes to help inform token balancing decisions between HIVE and HBD markets.

## Stats Structure
```javascript
stats.volumeEMA = {
    hive: {
        token: 12500000,    // TOKEN volume in HIVE market (millitoken)
        hive: 1250000       // HIVE volume (millihive)
    },
    hbd: {
        token: 7500000,     // TOKEN volume in HBD market (millitoken)
        hbd: 750000         // HBD volume (millihbd)
    },
    alpha: 0.1,             // EMA smoothing factor
    hiveRatio: "0.625",     // Proportion of token volume in HIVE market
    hbdRatio: "0.375"       // Proportion of token volume in HBD market
}
```

## EMA Calculation
The EMA is updated daily during the DAO process using:
```
EMA = α × current_volume + (1 - α) × previous_EMA
```

Where:
- α (alpha) = 0.1 (smoothing factor)
- Gives ~63% weight to last 10 periods
- More recent volumes have higher influence

## Volume Tracking
- **volHiveToken**: TOKEN volume traded in HIVE market
- **vols**: HIVE volume traded
- **volHbdToken**: TOKEN volume traded in HBD market  
- **volhbd**: HBD volume traded

## Use Cases

### 1. Market Preference Analysis
The `hiveRatio` and `hbdRatio` show which market users prefer:
- hiveRatio > 0.5: More trading activity in HIVE market
- hbdRatio > 0.5: More trading activity in HBD market

### 2. Liquidity Allocation
LP providers can use these ratios to:
- Allocate more liquidity to the busier market
- Balance liquidity based on actual usage patterns

### 3. Fee Optimization
Different fees could be set based on volume patterns:
- Lower fees for low-volume market to attract traders
- Higher fees for high-volume market to maximize revenue

### 4. Arbitrage Detection
Combined with price data, volume EMAs help identify:
- Which market drives price discovery
- Where arbitrage bots are most active

## Example Values
```javascript
// Balanced markets (50/50 split)
hiveRatio: "0.500", hbdRatio: "0.500"

// HIVE-dominant market (70/30 split)
hiveRatio: "0.700", hbdRatio: "0.300"

// HBD-dominant market (30/70 split)
hiveRatio: "0.300", hbdRatio: "0.700"
```

## Integration with Tally.js
The volume EMAs work together with tally.js metrics:
- `stats.dexArbitrage`: Price difference between markets
- `stats.dexValueBalance`: Current liquidity distribution
- `stats.volumeEMA`: Trading activity distribution

This provides a complete picture for market balancing decisions.