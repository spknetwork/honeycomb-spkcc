# Capital Curves and Collateral Management

## Table of Contents
1. [Overview](#overview)
2. [Bonding Curve Mechanics](#bonding-curve-mechanics)
3. [Collateral Management](#collateral-management)
4. [Market Conditions and Responses](#market-conditions-and-responses)
5. [Safety Mechanisms](#safety-mechanisms)
6. [Mathematical Models](#mathematical-models)
7. [Integration with AMM](#integration-with-amm)

## Overview

The DLUX/SPK DEX implements a sophisticated capital management system that combines:
- **Quadratic Bonding Curves** for initial price discovery
- **Automated Market Maker (AMM)** for established liquidity
- **Dynamic Collateral Limits** for system safety
- **Volume-Based Rebalancing** for optimal capital efficiency

## Bonding Curve Mechanics

### Quadratic Bonding Curve Formula

The system uses a quadratic bonding curve for initial token distribution:

```
Price(supply) = BasePrice × (1 + (supply / maxSupply)²)
```

Where:
- `BasePrice` = ICO price / 1000 (conversion from millihive to HIVE)
- `supply` = Current token supply in circulation
- `maxSupply` = safetyLimit / 2 (50% of safety limit in governance tokens)

**Important**: The safety limit is in governance tokens, not HIVE/HBD. This ensures that the total HIVE/HBD value held by the system never exceeds what the governance token holders can safely control through the multisig.

### Price Progression

The quadratic curve creates these characteristics:
1. **Low Initial Price**: Encourages early adoption
2. **Accelerating Price**: Rewards early participants
3. **Natural Cap**: Approaches infinity as supply approaches max

Example progression with BasePrice = 0.1 HIVE:
- 0% supply: 0.100 HIVE per token
- 25% supply: 0.106 HIVE per token
- 50% supply: 0.125 HIVE per token
- 75% supply: 0.156 HIVE per token
- 90% supply: 0.181 HIVE per token

### Hybrid Pricing Model

As liquidity accumulates, the system transitions to a hybrid model:

```
FinalPrice = (BondingPrice × BondingWeight) + (AMMPrice × AMMWeight)
```

Where:
- `AMMWeight = min(0.7, reserveAmount / (maxSupply × basePrice))`
- `BondingWeight = 1 - AMMWeight`

This creates a smooth transition from bonding curve to AMM pricing.

## Collateral Management

### Multi-Tier Collateral System

The system maintains safety through multiple collateral tiers:

1. **Safety Limit**: Maximum HIVE/HBD value that can be safely held
   - `safetyLimit = activeThreshold × minCollateral` (in governance tokens)
   - Represents the token amount needed to reach multisig threshold
   - This token amount × current price = maximum safe HIVE/HBD holdings
   - Example: If threshold requires 100,000 tokens and price is 0.5 HIVE/token, then maximum safe HIVE holdings = 50,000 HIVE

2. **MultiSig Collateral**: Total governance tokens held by all multisig participants
   - Sum of all participating nodes' governance token holdings
   - Used to calculate maximum safe liquid asset exposure
   - `maxSafeValue = multiSigCollateral × currentPrice`

3. **MS Holdings**: Direct HIVE/HBD holdings in multisig wallet
   - Actual liquid assets currently held
   - Must stay below the safety limit
   - Converted to common value using price feeds
   - Checked against both safetyLimit and multiSigCollateral limits

### Collateral Distribution

When new reserves are added through the bonding curve:

```
Total Tokens Minted = reserveAmount / currentPrice
├── Pool Share (33.3%) → Added to LP pool
└── Provider Share (66.7%) → Distributed to collateral providers
```

Distribution algorithm:
1. Weights based on multisig authority weights
2. Minimum collateral requirement (100 tokens)
3. Health score prioritization for remainders
4. Proportional distribution with rounding protection

### Collateral Health Scoring

Each provider's health is evaluated by:
```
HealthScore = CollateralAmount / AuthorityWeight
```

Higher scores indicate better collateralization relative to voting power.

## Market Conditions and Responses

### 1. Low Liquidity (Early Stage)

**Condition**: Pool token supply < 10% of max supply

**System Response**:
- Heavy reliance on bonding curve (70% weight)
- First sales executed through bonding curve
- Gradual transition to AMM as liquidity builds

**Collateral Protection**:
- Token minting limited to maintain safe HIVE/HBD exposure
- Maximum tokens mintable = safetyLimit / 2
- This ensures liquid holdings never exceed what threshold signers can control
- Distribution incentivizes collateral providers to increase safety limit

### 2. Normal Market Operations

**Condition**: Sufficient liquidity in both HIVE and HBD pools

**System Response**:
- Full AMM operation with constant product formula
- Volume-based pool rebalancing
- Standard swap fees (0.5% default)

**Collateral Protection**:
- Real-time collateral limit checks
- Maximum single operation limits
- Open order exposure tracking

### 3. High Volume Imbalance

**Condition**: Volume EMA shows >70% activity in one market

**System Response**:
- Automatic rebalancing triggered (>5% deviation)
- Maximum 50% of pool can be moved
- Target ratios: 25% minimum + volume adjustment

**Example Rebalancing**:
```
If HIVE volume = 90%, HBD volume = 10%:
- HIVE target = 25% + (90% / 2) = 70%
- HBD target = 25% + (10% / 2) = 30%
```

### 4. Collateral Stress

**Condition**: Total HIVE/HBD exposure approaching governance token backing

**System Response**:
- New operations blocked if they would cause unsafe exposure
- Safety check: `totalHiveValue <= governanceTokens × tokenPrice`
- Effective limit = min(safetyLimit, multiSigCollateral) × currentPrice
- Includes: LP holdings + open orders + MS holdings

**Recovery Actions**:
- No new buy orders accepted that increase HIVE/HBD exposure
- Token price increase improves safety margin
- System waits for more governance token collateral or reduced exposure

### 5. Maximum Supply Approach

**Condition**: Token supply approaching safety limit

**System Response**:
- Bonding curve minting restricted
- Only secondary market trading allowed
- Price discovery shifts entirely to AMM

## Safety Mechanisms

### 1. Supply Caps

- **Maximum Token Supply**: 50% of safety limit (in tokens)
- **Rationale**: Ensures liquid HIVE/HBD value never exceeds what governance token holders can safely control
- **Per-Operation Limits**: Prevent single large trades from destabilizing the system
- **Rebalancing Limits**: Maximum 50% pool movement to maintain market stability

### 2. Collateral Requirements

- **Distribution Minimum**: 100 tokens required
- **MultiSig Participation**: 100,000 tokens minimum
- **Health-Based Priority**: Better collateralized nodes preferred

### 3. Price Protection

- **Slippage Protection**: Constant product AMM
- **Fee Buffer**: 0.5% swap fee by default
- **Oracle Integration**: Price feeds for conversions

### 4. Operational Safeguards

- **Atomic Operations**: All-or-nothing execution
- **Revert on Limits**: Operations fail safely
- **Comprehensive Logging**: Full audit trail

## Mathematical Models

### Bonding Curve Integration

The cost to purchase tokens from supply point A to B:

```
Cost(A→B) = BasePrice × [
  (B - A) + 
  (B³ - A³) / (3 × maxSupply²)
]
```

This integral ensures exact pricing along the curve.

### Constant Product AMM

Standard x × y = k formula with fees:

```
OutputAmount = (InputAmount × (1 - fee) × OutputReserve) / 
               (InputReserve + InputAmount × (1 - fee))
```

### Volume EMA Calculation

Exponential moving average for volume tracking:

```
EMA_new = α × CurrentVolume + (1 - α) × EMA_old
```

Where α = 0.1 (10-period smoothing)

## Integration with AMM

### Transition Mechanics

1. **Pure Bonding Curve** (0-10% supply)
   - All pricing from quadratic curve
   - No AMM influence

2. **Hybrid Phase** (10-50% supply)
   - Weighted average pricing
   - Gradual AMM influence increase

3. **Pure AMM** (50%+ supply)
   - Bonding curve minting disabled
   - Full constant product pricing

### Arbitrage Opportunities

The dual-market system (HIVE/HBD) creates arbitrage opportunities that:
- Maintain price consistency
- Provide market depth
- Incentivize liquidity provision

### Volume-Based Capital Allocation

The system optimizes capital allocation by:
1. Tracking volume EMAs for each market
2. Calculating optimal pool ratios
3. Rebalancing when deviations exceed 5%
4. Respecting minimum 25% per market

## Configuration Reference

Key parameters from `CAPITAL_CONFIG`:

```javascript
{
  // Collateral Requirements
  MIN_COLLATERAL_FOR_DISTRIBUTION: 100,
  MIN_COLLATERAL_FOR_MULTISIG: 100000,
  
  // Safety Limits
  DEFAULT_SAFETY_LIMIT: 1000,
  MIN_SAFETY_LIMIT: 1000,
  
  // Bonding Curve
  BONDING_CURVE_BASE_DIVISOR: 1000,
  BONDING_CURVE_POOL_SHARE: 0.333,
  
  // Rebalancing
  REBALANCE_THRESHOLD: 0.05,
  MIN_POOL_RATIO: 0.25,
  MAX_REBALANCE_AMOUNT: 0.5,
  
  // Volume EMA
  VOLUME_EMA_ALPHA: 0.1,
  
  // Price Defaults
  DEFAULT_HIVE_PRICE: 0.217,
  DEFAULT_HIVE_PER_HBD: 4.608
}
```

## Example: Safety Limit in Action

Let's walk through a concrete example:

### Initial State
- MultiSig threshold weight: 51 (majority)
- Minimum node collateral: 100,000 governance tokens
- Safety limit: 51 × 100,000 = 5,100,000 governance tokens
- Current token price: 0.1 HIVE per token

### Maximum Safe HIVE Holdings
- Maximum safe HIVE = 5,100,000 tokens × 0.1 HIVE/token = 510,000 HIVE
- Maximum tokens that can be minted = 5,100,000 / 2 = 2,550,000 tokens

### Why This Works
1. **Threshold Control**: The multisig needs 51 weight to execute transactions
2. **Token Backing**: Each weight point represents 100,000 governance tokens minimum
3. **Value Protection**: Total HIVE/HBD value is limited by the governance token collateral
4. **Safety Margin**: Only minting 50% of safety limit provides buffer for price movements

### Price Impact on Safety
If token price increases to 0.2 HIVE:
- Same safety limit: 5,100,000 governance tokens
- New maximum safe HIVE = 5,100,000 × 0.2 = 1,020,000 HIVE
- System can safely hold more HIVE as token value increases

If token price decreases to 0.05 HIVE:
- Maximum safe HIVE = 5,100,000 × 0.05 = 255,000 HIVE
- System must reduce HIVE exposure or increase governance collateral

## Conclusion

The capital management system provides:
- **Robust Price Discovery**: Through bonding curves
- **Deep Liquidity**: Via dual-market AMM
- **System Safety**: Through multi-tier collateral
- **Market Efficiency**: Via automated rebalancing
- **Participant Incentives**: Through fair distribution

This creates a self-regulating system that maintains stability across all market conditions while incentivizing healthy participation and growth.