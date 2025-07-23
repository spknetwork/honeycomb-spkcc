import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

// Import the functions we're testing
import {
  calculateBondingCurvePrice,
  calculateBondingCurveCost,
  seedLpPool,
  addReserveToBondingCurve,
  distributeToCollateralProviders,
  checkCollateralLimit,
  balanceLiquidityPools,
  addLiquidity,
  executeLpSwap,
  executeFirstSale,
  calculateSwapOutput,
  calculateCurvePrice,
  calculateBalancingTargets,
  updateMSHeldValue,
  CAPITAL_CONFIG
} from '../processing_routes/dex.js';

describe('Capital Interfaces Test Suite', function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('Bonding Curve Calculations', function() {
    describe('calculateBondingCurvePrice', function() {
      it('should calculate base price correctly at zero supply', function() {
        const stats = { icoPrice: 100 };
        const price = calculateBondingCurvePrice(0, 1000000, 0, stats);
        expect(parseFloat(price)).to.equal(0.1); // 100/1000 = 0.1
      });

      it('should increase price quadratically with supply', function() {
        const stats = { icoPrice: 100 };
        const price1 = calculateBondingCurvePrice(250000, 1000000, 0, stats);
        const price2 = calculateBondingCurvePrice(500000, 1000000, 0, stats);
        const price3 = calculateBondingCurvePrice(750000, 1000000, 0, stats);
        
        expect(parseFloat(price1)).to.be.above(0.1);
        expect(parseFloat(price2)).to.be.above(parseFloat(price1));
        expect(parseFloat(price3)).to.be.above(parseFloat(price2));
      });

      it('should blend AMM and bonding curve prices when reserves exist', function() {
        const stats = { icoPrice: 100 };
        const purePrice = calculateBondingCurvePrice(500000, 1000000, 0, stats);
        const blendedPrice = calculateBondingCurvePrice(500000, 1000000, 50000, stats);
        
        expect(parseFloat(blendedPrice)).to.not.equal(parseFloat(purePrice));
      });

      it('should handle edge cases gracefully', function() {
        const stats = { icoPrice: 100 };
        
        // Max supply
        const maxPrice = calculateBondingCurvePrice(1000000, 1000000, 0, stats);
        expect(parseFloat(maxPrice)).to.be.above(0.1);
        
        // Zero max supply should not crash
        const zeroMaxPrice = calculateBondingCurvePrice(0, 0, 0, stats);
        expect(zeroMaxPrice).to.exist;
      });
    });

    describe('calculateBondingCurveCost', function() {
      it('should calculate integral cost correctly', function() {
        const basePrice = 0.1;
        const cost = calculateBondingCurveCost(0, 100000, 1000000, basePrice);
        
        expect(cost).to.be.above(0);
        expect(cost).to.be.below(100000 * basePrice * 2); // Should be less than linear max
      });

      it('should return zero for zero amount', function() {
        const cost = calculateBondingCurveCost(100000, 100000, 1000000, 0.1);
        expect(cost).to.equal(0);
      });
    });
  });

  describe('Collateral Limit Checking', function() {
    describe('checkCollateralLimit', function() {
      it('should approve operations within safety limits based on governance token backing', function() {
        const stats = {
          safetyLimit: 1000000, // 1M governance tokens (threshold requirement)
          multiSigCollateral: 500000, // 500k governance tokens held by all participants
          MSHeld: { HIVE: 100000, HBD: 50000 }, // Current liquid holdings in milliHIVE/HBD
          priceFeed: { hivePerHbd: "4.608" }
        };
        
        // Assuming current token price is 0.2 HIVE per token
        // Max safe HIVE = min(1M, 500k) * 0.2 = 100k HIVE
        // Current exposure = 100 HIVE + 50 HBD * 4.608 = 330.4 HIVE equivalent
        
        const dex = {
          hive: { pool: { hive: 50000 }, buyOrders: {} },
          hbd: { pool: { hbd: 10000 }, buyOrders: {} },
          tick: "0.2" // Current token price
        };
        
        // Adding 10k HIVE would be within limits
        const result = checkCollateralLimit(10000, 0, stats, dex);
        expect(result).to.be.true;
      });

      it('should reject operations exceeding governance token backing', function() {
        const stats = {
          safetyLimit: 100000, // 100k governance tokens (threshold requirement)
          multiSigCollateral: 50000, // Only 50k governance tokens held
          MSHeld: { HIVE: 40000, HBD: 5000 }, // 40 HIVE + 23 HIVE worth of HBD
          priceFeed: { hivePerHbd: "4.608" }
        };
        
        const dex = {
          hive: { pool: { hive: 30000 }, buyOrders: {} },
          hbd: { pool: { hbd: 5000 }, buyOrders: {} },
          tick: "1.0" // Current token price is 1 HIVE per token
        };
        
        // With token price at 1.0:
        // Max safe HIVE = min(100k, 50k) * 1.0 = 50k HIVE
        // Current exposure = 40 + 23 + 30 + 23 = 116 HIVE
        // Adding 50k more would far exceed the 50k HIVE limit
        
        const result = checkCollateralLimit(50000, 0, stats, dex);
        expect(result).to.be.false;
      });

      it('should handle single dex object structure', function() {
        const stats = {
          safetyLimit: 100000,
          multiSigCollateral: 100000,
          MSHeld: { HIVE: 10000, HBD: 5000 }
        };
        
        const dex = {
          pool: { token: 50000, hive: 25000 },
          buyOrders: {}
        };
        
        const result = checkCollateralLimit(10000, 0, stats, dex);
        expect(result).to.be.true;
      });

      it('should use more restrictive limit between safety and collateral', function() {
        const stats = {
          safetyLimit: 1000000, // 1M governance tokens (threshold)
          multiSigCollateral: 100000, // Only 100k tokens held (more restrictive)
          MSHeld: { HIVE: 50000, HBD: 10000 }
        };
        
        const dex = {
          hive: { pool: { hive: 40000 }, buyOrders: {} },
          hbd: { pool: { hbd: 5000 }, buyOrders: {} },
          tick: "0.5" // 0.5 HIVE per token
        };
        
        // Max safe HIVE = min(1M, 100k) * 0.5 = 50k HIVE
        // This should fail based on multiSigCollateral, not safetyLimit
        const result = checkCollateralLimit(60000, 0, stats, dex);
        expect(result).to.be.false;
      });

      it('should dynamically adjust safe limits based on token price', function() {
        const stats = {
          safetyLimit: 500000, // 500k governance tokens
          multiSigCollateral: 500000, // Same amount held
          MSHeld: { HIVE: 100000, HBD: 0 }, // 100 HIVE currently held
          priceFeed: { hivePerHbd: "5.0" }
        };
        
        // Test 1: Low token price = low HIVE capacity
        const dexLowPrice = {
          pool: { token: 100000, hive: 10000 },
          tick: "0.1" // 0.1 HIVE per token
        };
        
        // Max safe HIVE = 500k * 0.1 = 50k HIVE
        // Current: 100 HIVE, Adding: 40k would exceed
        let result = checkCollateralLimit(40000, 0, stats, dexLowPrice);
        expect(result).to.be.false;
        
        // Test 2: High token price = high HIVE capacity  
        const dexHighPrice = {
          pool: { token: 100000, hive: 50000 },
          tick: "1.0" // 1.0 HIVE per token
        };
        
        // Max safe HIVE = 500k * 1.0 = 500k HIVE
        // Current: 100 HIVE, Adding: 40k is fine
        result = checkCollateralLimit(40000, 0, stats, dexHighPrice);
        expect(result).to.be.true;
      });

      it('should include open buy orders in calculations', function() {
        const stats = {
          safetyLimit: 100000,
          multiSigCollateral: 100000,
          MSHeld: { HIVE: 20000, HBD: 5000 }
        };
        
        const dex = {
          hive: {
            pool: { hive: 30000 },
            buyOrders: {
              '1': { hive: 20000 },
              '2': { hive: 10000 }
            }
          },
          hbd: {
            pool: { hbd: 5000 },
            buyOrders: {
              '3': { hbd: 5000 }
            }
          }
        };
        
        // Total exposure would be too high with new order
        const result = checkCollateralLimit(30000, 0, stats, dex);
        expect(result).to.be.false;
      });
    });
  });

  describe('LP Pool Rebalancing', function() {
    describe('calculateBalancingTargets', function() {
      it('should calculate targets based on volume EMAs', function() {
        const stats = {
          volumeEMA: {
            hiveRatio: 0.7,
            hbdRatio: 0.3
          }
        };
        
        const targets = calculateBalancingTargets(stats);
        expect(targets.hive).to.be.above(0.25);
        expect(targets.hive).to.be.below(0.75);
        expect(targets.hbd).to.be.above(0.25);
        expect(targets.hbd).to.be.below(0.75);
        expect(targets.hive + targets.hbd).to.be.closeTo(1, 0.001);
      });

      it('should default to 50/50 without volume data', function() {
        const stats = {};
        const targets = calculateBalancingTargets(stats);
        
        expect(targets.hive).to.equal(0.5);
        expect(targets.hbd).to.equal(0.5);
      });

      it('should respect minimum pool ratios', function() {
        const stats = {
          volumeEMA: {
            hiveRatio: 0.95,
            hbdRatio: 0.05
          }
        };
        
        const targets = calculateBalancingTargets(stats);
        expect(targets.hive).to.be.at.most(0.725); // 0.25 + 0.95/2
        expect(targets.hbd).to.be.at.least(0.275); // 0.25 + 0.05/2
      });
    });

    describe('balanceLiquidityPools', function() {
      it('should not rebalance when within threshold', function() {
        const dexHive = {
          pool: { token: 500000, hive: 250000 },
          tick: "0.5"
        };
        const dexHbd = {
          pool: { token: 500000, hbd: 50000 },
          tick: "0.1"
        };
        const stats = {
          priceFeed: { hivePerHbd: "5.0" },
          volumeEMA: { hiveRatio: 0.5, hbdRatio: 0.5 }
        };
        
        const result = balanceLiquidityPools(dexHive, dexHbd, stats);
        expect(result.success).to.be.true;
        expect(result.message).to.include("balanced");
        expect(result.tokenAmount).to.be.undefined;
      });

      it('should calculate rebalancing amounts when needed', function() {
        const dexHive = {
          pool: { token: 800000, hive: 400000 },
          tick: "0.5"
        };
        const dexHbd = {
          pool: { token: 200000, hbd: 20000 },
          tick: "0.1"
        };
        const stats = {
          priceFeed: { hivePerHbd: "5.0" },
          volumeEMA: { hiveRatio: 0.5, hbdRatio: 0.5 }
        };
        
        const result = balanceLiquidityPools(dexHive, dexHbd, stats);
        expect(result.success).to.be.true;
        expect(result.tokenAmount).to.be.above(0);
        expect(result.fromPool).to.equal("hive");
        expect(result.toPool).to.equal("hbd");
      });

      it('should respect maximum rebalance limits', function() {
        const dexHive = {
          pool: { token: 1000000, hive: 500000 },
          tick: "0.5"
        };
        const dexHbd = {
          pool: { token: 100000, hbd: 10000 },
          tick: "0.1"
        };
        const stats = {
          priceFeed: { hivePerHbd: "5.0" },
          volumeEMA: { hiveRatio: 0.5, hbdRatio: 0.5 }
        };
        
        const result = balanceLiquidityPools(dexHive, dexHbd, stats);
        expect(result.tokenAmount).to.be.at.most(500000); // 50% of hive pool
      });

      it('should handle empty pools gracefully', function() {
        const dexHive = { pool: { token: 0, hive: 0 } };
        const dexHbd = { pool: { token: 0, hbd: 0 } };
        const stats = {};
        
        const result = balanceLiquidityPools(dexHive, dexHbd, stats);
        expect(result.success).to.be.false;
        expect(result.message).to.include("No liquidity");
      });
    });
  });

  describe('Token Distribution', function() {
    describe('distributeToCollateralProviders', function() {
      it('should distribute tokens proportionally to weights', function() {
        const tokensToDistribute = 100000;
        const stats = {
          ms: {
            active_account_auths: {
              'node1': 10,
              'node2': 20,
              'node3': 30
            }
          }
        };
        const nodes = {
          'node1': { g: 200000 },
          'node2': { g: 300000 },
          'node3': { g: 400000 }
        };
        
        const distribution = distributeToCollateralProviders(tokensToDistribute, stats, nodes);
        
        expect(distribution.node1).to.be.closeTo(16667, 1);
        expect(distribution.node2).to.be.closeTo(33333, 1);
        expect(distribution.node3).to.be.closeTo(50000, 1);
        
        const total = Object.values(distribution).reduce((a, b) => a + b, 0);
        expect(total).to.equal(tokensToDistribute);
      });

      it('should exclude nodes with insufficient collateral', function() {
        const tokensToDistribute = 100000;
        const stats = {
          ms: {
            active_account_auths: {
              'node1': 10,
              'node2': 20,
              'node3': 30
            }
          }
        };
        const nodes = {
          'node1': { g: 50 }, // Below minimum
          'node2': { g: 300000 },
          'node3': { g: 400000 }
        };
        
        const distribution = distributeToCollateralProviders(tokensToDistribute, stats, nodes);
        
        expect(distribution.node1).to.be.undefined;
        expect(distribution.node2).to.exist;
        expect(distribution.node3).to.exist;
      });

      it('should handle rounding remainder correctly', function() {
        const tokensToDistribute = 100;
        const stats = {
          ms: {
            active_account_auths: {
              'node1': 1,
              'node2': 1,
              'node3': 1
            }
          }
        };
        const nodes = {
          'node1': { g: 100000 },
          'node2': { g: 200000 },
          'node3': { g: 300000 }
        };
        
        const distribution = distributeToCollateralProviders(tokensToDistribute, stats, nodes);
        const total = Object.values(distribution).reduce((a, b) => a + b, 0);
        expect(total).to.equal(tokensToDistribute);
      });

      it('should prioritize healthier nodes for remainder', function() {
        const tokensToDistribute = 101; // Will have remainder
        const stats = {
          ms: {
            active_account_auths: {
              'node1': 10,
              'node2': 10,
              'node3': 10
            }
          }
        };
        const nodes = {
          'node1': { g: 100000 }, // Lowest collateral/weight ratio
          'node2': { g: 200000 },
          'node3': { g: 300000 }  // Highest collateral/weight ratio
        };
        
        const distribution = distributeToCollateralProviders(tokensToDistribute, stats, nodes);
        
        // Node3 should get the remainder due to better health
        expect(distribution.node3).to.be.above(distribution.node1);
      });

      it('should handle edge cases gracefully', function() {
        // No tokens to distribute
        let result = distributeToCollateralProviders(0, {}, {});
        expect(Object.keys(result)).to.have.length(0);
        
        // No multisig data
        result = distributeToCollateralProviders(100000, {}, {});
        expect(Object.keys(result)).to.have.length(0);
        
        // No eligible nodes
        const stats = {
          ms: {
            active_account_auths: {
              'node1': 10
            }
          }
        };
        result = distributeToCollateralProviders(100000, stats, {});
        expect(Object.keys(result)).to.have.length(0);
      });
    });
  });

  describe('Liquidity Provision', function() {
    describe('addLiquidity', function() {
      it('should initialize empty pool with bonding curve based on governance tokens', function() {
        const dex = { pool: { token: 0, hive: 0 } };
        const stats = { safetyLimit: 1000000 }; // 1M governance tokens
        
        const result = addLiquidity(dex, 0, 0, 'hive', stats);
        
        expect(result.success).to.be.true;
        expect(result.message).to.include("bonding curve");
        // Max supply is 50% of safety limit to ensure HIVE value stays safe
        expect(dex.pool.maxSupply).to.equal(500000); // 500k tokens max
      });

      it('should seed pool with initial liquidity', function() {
        const dex = { pool: { token: 0, hive: 0 } };
        const stats = { safetyLimit: 1000000 };
        
        const result = addLiquidity(dex, 100000, 50000, 'hive', stats);
        
        expect(result.success).to.be.true;
        expect(result.lpTokens).to.be.above(0);
        expect(dex.pool.token).to.equal(100000);
        expect(dex.pool.hive).to.equal(50000);
      });

      it('should add reserves through bonding curve', function() {
        const dex = {
          pool: { token: 0, hive: 0, maxSupply: 500000 },
          tick: "0.1"
        };
        const stats = {
          safetyLimit: 1000000,
          ms: {
            active_account_auths: { 'node1': 10 }
          }
        };
        
        const result = addLiquidity(dex, 0, 50000, 'hive', stats);
        
        expect(result.success).to.be.true;
        expect(result.tokensMinted).to.be.above(0);
        expect(result.distribution).to.exist;
      });

      it('should require balanced liquidity for existing pools', function() {
        const dex = {
          pool: { token: 100000, hive: 50000 },
          tick: "0.5"
        };
        const stats = {};
        
        // Imbalanced liquidity
        const result = addLiquidity(dex, 10000, 10000, 'hive', stats);
        
        expect(result.success).to.be.false;
        expect(result.error).to.include("Imbalanced");
      });

      it('should calculate LP tokens correctly', function() {
        const dex = {
          pool: { token: 100000, hive: 50000 },
          tick: "0.5"
        };
        const stats = {};
        
        // Balanced liquidity (same ratio)
        const result = addLiquidity(dex, 10000, 5000, 'hive', stats);
        
        expect(result.success).to.be.true;
        expect(result.lpTokens).to.be.above(0);
        expect(dex.pool.token).to.equal(110000);
        expect(dex.pool.hive).to.equal(55000);
      });
    });

    describe('addReserveToBondingCurve', function() {
      it('should mint tokens based on bonding curve price', function() {
        const dex = {
          pool: { token: 100000, hive: 10000 },
          tick: "0.1"
        };
        const stats = {
          safetyLimit: 1000000,
          ms: {
            active_account_auths: { 'node1': 10 }
          }
        };
        const nodes = { 'node1': { g: 100000 } };
        
        const result = addReserveToBondingCurve(dex, 5000, 'hive', stats, nodes);
        
        expect(result.success).to.be.true;
        expect(result.tokensMinted).to.be.above(0);
        expect(result.poolShare).to.be.above(0);
        expect(result.providerShare).to.be.above(0);
        expect(result.poolShare + result.providerShare).to.equal(result.tokensMinted);
      });

      it('should respect maximum supply limits', function() {
        const dex = {
          pool: { token: 490000, hive: 100000, maxSupply: 500000 },
          tick: "0.2"
        };
        const stats = { safetyLimit: 1000000 };
        
        const result = addReserveToBondingCurve(dex, 50000, 'hive', stats, {});
        
        expect(result.success).to.be.false;
        expect(result.error).to.include("exceed");
        expect(result.maxTokens).to.be.at.most(10000);
      });

      it('should distribute tokens correctly', function() {
        const dex = {
          pool: { token: 100000, hive: 10000 },
          tick: "0.1"
        };
        const stats = {
          safetyLimit: 1000000,
          ms: {
            active_account_auths: {
              'node1': 20,
              'node2': 30
            }
          }
        };
        const nodes = {
          'node1': { g: 200000 },
          'node2': { g: 300000 }
        };
        
        const result = addReserveToBondingCurve(dex, 10000, 'hive', stats, nodes);
        
        expect(result.success).to.be.true;
        expect(result.distribution.node1).to.exist;
        expect(result.distribution.node2).to.exist;
        expect(result.distribution.node2).to.be.above(result.distribution.node1);
      });
    });
  });

  describe('Swap Execution', function() {
    describe('calculateSwapOutput', function() {
      it('should calculate constant product AMM output', function() {
        const output = calculateSwapOutput(1000, 100000, 50000, 0.005);
        
        expect(output).to.be.above(0);
        expect(output).to.be.below(1000); // Should have slippage
      });

      it('should apply fees correctly', function() {
        const noFeeOutput = calculateSwapOutput(1000, 100000, 50000, 0);
        const withFeeOutput = calculateSwapOutput(1000, 100000, 50000, 0.005);
        
        expect(withFeeOutput).to.be.below(noFeeOutput);
        expect(withFeeOutput).to.be.closeTo(noFeeOutput * 0.995, 1);
      });

      it('should handle edge cases', function() {
        // Zero input
        expect(calculateSwapOutput(0, 100000, 50000, 0.005)).to.equal(0);
        
        // Zero reserves should not crash
        expect(calculateSwapOutput(1000, 0, 50000, 0.005)).to.equal(0);
      });
    });

    describe('executeLpSwap', function() {
      it('should execute swaps with proper accounting', function() {
        const dex = {
          pool: { token: 100000, hive: 50000 },
          tick: "0.5"
        };
        const stats = { dex_fee: 0.005 };
        
        const result = executeLpSwap(1000, 'hive', dex, stats);
        
        expect(result.success).to.be.true;
        expect(result.amountOut).to.be.above(0);
        expect(dex.pool.hive).to.equal(51000);
        expect(dex.pool.token).to.be.below(100000);
      });

      it('should update tick price after swap', function() {
        const dex = {
          pool: { token: 100000, hive: 50000 },
          tick: "0.5"
        };
        const stats = { dex_fee: 0.005 };
        
        const oldTick = parseFloat(dex.tick);
        executeLpSwap(10000, 'hive', dex, stats);
        const newTick = parseFloat(dex.tick);
        
        expect(newTick).to.not.equal(oldTick);
        expect(newTick).to.be.above(oldTick); // Price should increase when buying tokens
      });

      it('should handle both directions', function() {
        const dex = {
          pool: { token: 100000, hive: 50000 },
          tick: "0.5"
        };
        const stats = { dex_fee: 0.005 };
        
        // Buy tokens with HIVE
        const buyResult = executeLpSwap(1000, 'hive', dex, stats);
        expect(buyResult.success).to.be.true;
        
        // Sell tokens for HIVE
        const sellResult = executeLpSwap(500, 'token', dex, stats);
        expect(sellResult.success).to.be.true;
      });
    });

    describe('executeFirstSale', function() {
      it('should handle first sale through bonding curve', function() {
        const dex = {
          pool: { token: 0, hive: 0, maxSupply: 500000 }
        };
        const stats = { icoPrice: 100 };
        
        const result = executeFirstSale(dex, 10000, 'hive', stats, 'buyer1');
        
        expect(result.success).to.be.true;
        expect(result.tokensBought).to.be.above(0);
        expect(result.totalCost).to.be.closeTo(10000, 1);
        expect(dex.pool.token).to.equal(result.tokensBought);
        expect(dex.pool.hive).to.equal(10000);
      });

      it('should track buyer information', function() {
        const dex = {
          pool: { token: 0, hive: 0, maxSupply: 500000 }
        };
        const stats = { icoPrice: 100 };
        
        executeFirstSale(dex, 5000, 'hive', stats, 'buyer1');
        executeFirstSale(dex, 3000, 'hive', stats, 'buyer2');
        
        expect(dex.ico.buyers.buyer1).to.exist;
        expect(dex.ico.buyers.buyer2).to.exist;
        expect(dex.ico.buyers.buyer1).to.be.above(dex.ico.buyers.buyer2);
      });
    });
  });

  describe('Price Calculations', function() {
    describe('calculateCurvePrice', function() {
      it('should calculate constant product price', function() {
        const price = calculateCurvePrice(100000, 50000);
        expect(parseFloat(price)).to.equal(0.5);
      });

      it('should handle zero reserves', function() {
        expect(calculateCurvePrice(0, 50000)).to.equal("0.000000");
        expect(calculateCurvePrice(100000, 0)).to.equal("0.000000");
      });

      it('should format to 6 decimal places', function() {
        const price = calculateCurvePrice(100000, 33333);
        expect(price).to.match(/^\d+\.\d{6}$/);
      });
    });

    describe('updateMSHeldValue', function() {
      it('should calculate total value in millidollars', function() {
        const stats = {
          MSHeld: { HIVE: 100000, HBD: 50000 },
          priceFeed: { hivePrice: "0.3", hivePerHbd: "3.333" }
        };
        
        const value = updateMSHeldValue(stats);
        
        expect(value).to.equal(80000); // 100000 * 0.3 + 50000
      });

      it('should initialize missing data', function() {
        const stats = {};
        
        updateMSHeldValue(stats);
        
        expect(stats.MSHeld).to.exist;
        expect(stats.priceFeed).to.exist;
        expect(stats.MSHeld.VALUE).to.equal(0);
      });

      it('should use default prices if not provided', function() {
        const stats = {
          MSHeld: { HIVE: 1000000, HBD: 0 }
        };
        
        const value = updateMSHeldValue(stats);
        
        expect(value).to.be.closeTo(217000, 1000); // Using default 0.217
      });
    });
  });

  describe('Integration Scenarios', function() {
    it('should demonstrate governance token backed safety limits', function() {
      // Scenario: MultiSig with 51 threshold weight, 100k min collateral
      const stats = {
        safetyLimit: 5100000, // 51 * 100k = 5.1M governance tokens
        multiSigCollateral: 6000000, // Actual holdings: 6M tokens
        MSHeld: { HIVE: 0, HBD: 0 }, // Start with no liquid assets
        priceFeed: { hivePerHbd: "5.0" },
        icoPrice: 100,
        dex_fee: 0.005
      };
      
      const dex = {
        pool: { token: 0, hive: 0 },
        tick: "0.1" // Start at 0.1 HIVE per token
      };
      
      // Max tokens that can be minted = 5.1M / 2 = 2.55M
      addLiquidity(dex, 0, 0, 'hive', stats);
      expect(dex.pool.maxSupply).to.equal(2550000);
      
      // At 0.1 HIVE per token, max safe HIVE = 5.1M * 0.1 = 510k HIVE
      let safeToAdd = checkCollateralLimit(500000, 0, stats, dex);
      expect(safeToAdd).to.be.true;
      
      // Simulate adding HIVE through bonding curve
      stats.MSHeld.HIVE = 300000000; // 300k HIVE in milliHIVE
      updateMSHeldValue(stats);
      
      // As people buy tokens, price increases
      dex.tick = "0.2"; // Price doubled
      dex.pool.token = 1000000; // 1M tokens in circulation
      dex.pool.hive = 150000000; // 150k HIVE in pool
      
      // Now max safe HIVE = 5.1M * 0.2 = 1.02M HIVE
      // Current exposure = 300k + 150k = 450k HIVE
      // Can still add more
      safeToAdd = checkCollateralLimit(500000, 0, stats, dex);
      expect(safeToAdd).to.be.true;
      
      // But if price drops...
      dex.tick = "0.08"; // Price crashed
      
      // Max safe HIVE = 5.1M * 0.08 = 408k HIVE
      // Current exposure = 450k HIVE > 408k limit!
      // Cannot add any more HIVE
      safeToAdd = checkCollateralLimit(1000, 0, stats, dex);
      expect(safeToAdd).to.be.false;
      
      // System must wait for:
      // 1. Token price to recover, OR
      // 2. More governance token collateral, OR  
      // 3. Reduction in HIVE exposure
    });

    it('should handle complete bonding curve lifecycle', function() {
      const stats = {
        icoPrice: 100,
        safetyLimit: 1000000, // 1M governance tokens
        ms: {
          active_account_auths: {
            'node1': 30,
            'node2': 20,
            'node3': 10
          }
        }
      };
      const nodes = {
        'node1': { g: 300000 },
        'node2': { g: 200000 },
        'node3': { g: 100000 }
      };
      
      // Initialize empty pool
      const dex = { pool: {} };
      let result = addLiquidity(dex, 0, 0, 'hive', stats);
      expect(result.success).to.be.true;
      
      // First sale through bonding curve
      result = executeFirstSale(dex, 10000, 'hive', stats, 'buyer1');
      expect(result.success).to.be.true;
      
      // Add reserves through bonding curve
      result = addReserveToBondingCurve(dex, 50000, 'hive', stats, nodes);
      expect(result.success).to.be.true;
      
      // Execute LP swap once enough liquidity
      result = executeLpSwap(1000, 'hive', dex, stats);
      expect(result.success).to.be.true;
      
      // Verify final state
      expect(dex.pool.token).to.be.above(0);
      expect(dex.pool.hive).to.be.above(61000);
      expect(parseFloat(dex.tick)).to.be.above(0);
    });

    it('should maintain collateral limits through market cycles', function() {
      const stats = {
        safetyLimit: 100000,
        multiSigCollateral: 80000,
        MSHeld: { HIVE: 20000, HBD: 5000 },
        priceFeed: { hivePerHbd: "5.0" },
        dex_fee: 0.005
      };
      
      const dex = {
        hive: {
          pool: { token: 50000, hive: 25000 },
          buyOrders: {}
        },
        hbd: {
          pool: { token: 50000, hbd: 5000 },
          buyOrders: {}
        }
      };
      
      // Should allow operations within limits
      let allowed = checkCollateralLimit(10000, 0, stats, dex);
      expect(allowed).to.be.true;
      
      // Execute swap
      executeLpSwap(10000, 'hive', dex.hive, stats);
      
      // Should still be within limits
      allowed = checkCollateralLimit(5000, 0, stats, dex);
      expect(allowed).to.be.true;
      
      // Large operation should be blocked
      allowed = checkCollateralLimit(50000, 0, stats, dex);
      expect(allowed).to.be.false;
    });

    it('should handle volume-based rebalancing', function() {
      const stats = {
        priceFeed: { hivePerHbd: "5.0" },
        volumeEMA: {
          hive: { token: 1000000, hive: 500000 },
          hbd: { token: 100000, hbd: 10000 },
          hiveRatio: 0.9,
          hbdRatio: 0.1
        }
      };
      
      const dexHive = {
        pool: { token: 500000, hive: 250000 },
        tick: "0.5"
      };
      const dexHbd = {
        pool: { token: 500000, hbd: 50000 },
        tick: "0.1"
      };
      
      // Should trigger rebalancing due to volume imbalance
      const result = balanceLiquidityPools(dexHive, dexHbd, stats);
      
      expect(result.success).to.be.true;
      expect(result.fromPool).to.equal('hbd');
      expect(result.toPool).to.equal('hive');
      expect(result.tokenAmount).to.be.above(0);
    });
  });

  describe('Edge Cases and Error Handling', function() {
    it('should handle missing stats gracefully', function() {
      const dex = { pool: { token: 100000, hive: 50000 } };
      
      // Should use defaults
      const result = addLiquidity(dex, 10000, 5000, 'hive', {});
      expect(result.success).to.be.true;
    });

    it('should handle division by zero', function() {
      expect(() => calculateBondingCurvePrice(100, 0, 0, {})).to.not.throw();
      expect(() => calculateSwapOutput(100, 0, 0, 0.005)).to.not.throw();
      expect(() => calculateCurvePrice(0, 0)).to.not.throw();
    });

    it('should handle overflow conditions', function() {
      const hugeNumber = Number.MAX_SAFE_INTEGER;
      
      // Should not crash or return invalid results
      const result = checkCollateralLimit(hugeNumber, 0, { safetyLimit: 1000 }, {});
      expect(result).to.be.false;
    });

    it('should validate configuration constants', function() {
      expect(CAPITAL_CONFIG.MIN_COLLATERAL_FOR_DISTRIBUTION).to.be.above(0);
      expect(CAPITAL_CONFIG.REBALANCE_THRESHOLD).to.be.above(0).and.below(1);
      expect(CAPITAL_CONFIG.MIN_POOL_RATIO).to.be.above(0).and.below(0.5);
      expect(CAPITAL_CONFIG.BONDING_CURVE_POOL_SHARE).to.be.above(0).and.below(1);
    });
  });
});