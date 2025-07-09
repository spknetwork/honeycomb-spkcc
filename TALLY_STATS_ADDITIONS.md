# Tally.js Stats Additions

## New Stats Fields

### 0. `stats.pools`
- **Purpose**: Lightweight storage of LP pool reserves
- **Structure**: 
  ```javascript
  stats.pools = {
    hive: { token: 0, hive: 0 },
    hbd: { token: 0, hbd: 0 }
  }
  ```
- **Uses**: Enables pool-based calculations without fetching full DEX objects

### 1. `stats.safetyLimitHBD`
- **Purpose**: Safety limit expressed in HBD value (instead of tokens)
- **Calculation**: `safetyLimit * TOKEN/HBD price`
- **Update Frequency**: Every 5 minutes during tally
- **Uses**: 
  - Compare collateral limits in stable currency terms
  - Risk assessment independent of token price volatility

### 2. `stats.dexArbitrage`
- **Purpose**: Percentage arbitrage opportunity between HIVE and HBD markets
- **Calculation**: `((hbdTick - expectedHbdTick) / expectedHbdTick * 100)`
  - Where `expectedHbdTick = hiveTick * hivePerHbd`
- **Interpretation**:
  - Positive: HBD market overpriced relative to HIVE market
  - Negative: HBD market underpriced relative to HIVE market
  - Near 0: Markets are in equilibrium
- **Example**: "2.50" means 2.5% arbitrage opportunity

### 3. `stats.dexValueBalance`
- **Purpose**: Ratio of total value in HIVE pool vs HBD pool
- **Calculation**: `(HIVE pool value in HBD) / (HBD pool value)`
- **Interpretation**:
  - 1.0: Equal value in both pools
  - >1.0: More value locked in HIVE pool
  - <1.0: More value locked in HBD pool
- **Uses**: 
  - Monitor liquidity distribution
  - Identify which pool needs more liquidity

## Implementation Details

The calculations use:
- `dexHive.tick`: TOKEN/HIVE price from order book
- `dexHbd.tick`: TOKEN/HBD price from order book
- `stats.priceFeed.hivePerHbd`: HIVE/HBD exchange rate
- `stats.priceFeed.hivePrice`: HIVE price in USD

All values are calculated during the tally process (every 5 minutes) to ensure consistency across the network.

## Example Values

```javascript
stats: {
  safetyLimit: 100000,        // 100k tokens
  safetyLimitHBD: 10000,      // Worth 10k HBD at current prices
  dexArbitrage: "1.25",       // 1.25% arbitrage opportunity
  dexValueBalance: "1.150",   // 15% more value in HIVE pool
  // ... other stats
}
```