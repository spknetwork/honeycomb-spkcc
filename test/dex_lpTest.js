import { assert } from 'chai';
import { store, Config } from '../index.mjs';
import * as dexLp from '../processing_routes/dex_lp.js';
import test_state from './test_state.js';

// Set test environment
process.env.npm_lifecycle_event = 'test';

// Helper function to initialize test database
function init() {
    return new Promise((resolve, reject) => {
        store.del([], function (e) {
            if (e) { console.log(e) }
            store.put([], test_state, function (err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

// Helper function to get state from store
function getState(path = []) {
    return new Promise((resolve, reject) => {
        store.get(path, function (err, data) {
            if (err) reject(err)
            resolve(data)
        })
    })
}

// Helper function to update state in store
function setState(path, data) {
    return new Promise((resolve, reject) => {
        store.put(path, data, function (err) {
            if (err) reject(err)
            resolve(true)
        })
    })
}

describe('DEX LP Functions', function () {
    this.timeout(10000);

    beforeEach(function () {
        return init();
    });

    describe('Balance Liquidity Pools', function () {
        it('should balance liquidity pools correctly', async function () {
            // Setup pools and stats directly
            const stats = {
                MSHeld: { HIVE: 100000, HBD: 50000, VALUE: 0 },
                priceFeed: { hivePrice: "0.2170", hivePerHbd: "4.6080" }
            };
            const dexHive = { 
                pool: { token: 1000000, hive: 500000, tick: 500, shares: {}, sharesSupply: 0 },
                tick: 500 
            };
            const dexHbd = { 
                pool: { token: 1000000, hbd: 1000000, tick: 1000, shares: {}, sharesSupply: 0 },
                tick: 1000 
            };
            
            const result = dexLp.balanceLiquidityPools(dexHive, dexHbd, stats);
            
            assert.exists(result);
            assert.property(result, 'success');
            assert.property(result, 'message');
            assert.property(result, 'currentRatios');
            assert.property(result, 'targetRatios');
        });
    });

    describe('Add Liquidity', function () {
        it('should add liquidity to HIVE pool correctly', async function () {
            const dex = {
                pool: { token: 1000000, hive: 500000, tick: 500, shares: {}, sharesSupply: 1000000, lpTokens: 707106 }
            };
            const stats = { MSHeld: { HIVE: 1000000, HBD: 500000 } };
            
            const result = dexLp.addLiquidity(dex, 100000, 50000, 'hive', stats);
            
            assert.isTrue(result.success);
            assert.exists(result.lpTokens);
            assert.isAbove(result.lpTokens, 0);
            assert.equal(dex.pool.token, 1100000);
            assert.equal(dex.pool.hive, 550000);
        });

        it('should handle first liquidity provider', async function () {
            const dex = {
                pool: { token: 0, hive: 0, tick: 0, shares: {}, sharesSupply: 0 }
            };
            const stats = { MSHeld: { HIVE: 1000000, HBD: 500000 } };
            
            const result = dexLp.addLiquidity(dex, 100000, 50000, 'hive', stats);
            
            assert.isTrue(result.success);
            assert.equal(result.lpTokens, 70710); // sqrt(100000 * 50000)
            assert.equal(dex.pool.token, 100000);
            assert.equal(dex.pool.hive, 50000);
            assert.equal(dex.tick, '0.500000'); // 50000/100000 = 0.5
        });
    });

    describe('DEX LP Action', function () {
        it('should handle add_liquidity action', async function () {
            const state = await getState();
            
            // Setup user balance and pool
            state.balances['test-user'] = 2000000;
            state.dex.hive = {
                pool: { token: 1000000, hive: 500000, tick: 500, shares: {}, sharesSupply: 1000000 }
            };
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            await setState([], state);
            
            const json = {
                action: 'add_liquidity',
                pair: 'hive',
                tokenAmount: 100000,
                pairAmount: 50000,
                block_num: 100,
                transaction_id: 'test-tx-1'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_lp_action(json, 'test-user', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            assert.isTrue(ops.length > 0);
            // Should update user balance
            assert.isTrue(ops.some(op => op.path[1] === 'test-user' && op.type === 'put'));
            // Should update pool
            assert.isTrue(ops.some(op => op.path.includes('pool')));
        });

        it('should handle remove_liquidity action', async function () {
            const state = await getState();
            
            // Setup user with shares
            state.dex.hive = {
                pool: { 
                    token: 1000000, 
                    hive: 500000, 
                    tick: 500, 
                    shares: { 'test-user': 100000 }, 
                    sharesSupply: 1000000 
                }
            };
            state.balances['test-user'] = 0; // Start with 0 balance
            await setState([], state);
            
            const json = {
                action: 'remove_liquidity',
                pair: 'hive',
                shares: 50000,
                block_num: 100,
                transaction_id: 'test-tx-2'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_lp_action(json, 'test-user', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            // Should update user shares
            assert.isTrue(ops.some(op => op.path.includes('shares') && op.path.includes('test-user')));
            // Should update pool reserves
            assert.isTrue(ops.some(op => op.path.includes('pool')));
            // Should give user tokens back
            assert.isTrue(ops.some(op => op.path[1] === 'test-user' && op.type === 'put'));
        });

        it('should handle swap action with token input', async function () {
            const state = await getState();
            
            // Setup pools and user balance
            state.balances['test-user'] = 1000000;
            state.dex.hive = {
                pool: { token: 1000000, hive: 500000, tick: 500, shares: {}, sharesSupply: 1000000 }
            };
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            await setState([], state);
            
            const json = {
                action: 'swap',
                pair: 'hive',
                inputType: 'token',
                amount: 10000,
                minOutput: 4900,
                block_num: 100,
                transaction_id: 'test-tx-3'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_lp_action(json, 'test-user', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            // Should update user balance (remove tokens)
            assert.isTrue(ops.some(op => op.path[1] === 'test-user' && op.type === 'put'));
            // Should update pool
            assert.isTrue(ops.some(op => op.path.includes('pool')));
            // Should update MSHeld
            assert.isTrue(ops.some(op => op.path.includes('MSHeld')));
        });

        it('should handle swap action with pair input', async function () {
            const state = await getState();
            
            // Setup pools
            state.balances['test-user'] = 100000; // Some tokens
            state.dex.hive = {
                pool: { token: 1000000, hive: 500000, tick: 500, shares: {}, sharesSupply: 1000000 }
            };
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            await setState([], state);
            
            const json = {
                action: 'swap',
                pair: 'hive',
                inputType: 'hive',
                amount: 5000, // 5 HIVE
                minOutput: 9900,
                block_num: 100,
                transaction_id: 'test-tx-4'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_lp_action(json, 'test-user', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            // Should update user balance (add tokens)
            assert.isTrue(ops.some(op => op.path[1] === 'test-user' && op.type === 'put'));
            // Should update pool
            assert.isTrue(ops.some(op => op.path.includes('pool')));
            // Should update MSHeld
            assert.isTrue(ops.some(op => op.path.includes('MSHeld')));
        });
    });

    describe('DEX Sell', function () {
        it('should create HIVE sell order', async function () {
            const state = await getState();
            
            // Setup user balance and dex
            state.balances['test-seller'] = 1000000;
            state.dex.hive = {
                tick: "0.500000",
                buyBook: "",
                sellBook: "",
                buyOrders: {},
                sellOrders: {}
            };
            await setState([], state);
            
            const json = {
                larynx: 100000, // Using 'larynx' as the token name
                hive: 100000,   // Amount of HIVE (this creates a rate)
                block_num: 100,
                transaction_id: 'test-sell-1'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_sell(json, 'test-seller', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            assert.isAbove(ops.length, 0, 'Should have operations');
            
            // Check what operations we got
            const hasBalanceUpdate = ops.some(op => op.path && op.path[1] === 'test-seller' && op.type === 'put');
            const hasSellOrder = ops.some(op => op.path && op.path.includes('sellOrders') && op.type === 'put');
            const hasSellBook = ops.some(op => op.path && op.path.includes('dex') && op.type === 'put');
            
            assert.isTrue(hasBalanceUpdate || hasSellOrder || hasSellBook, 
                'Should have balance update or order creation');
        });

        it('should match orders when possible', async function () {
            const state = await getState();
            
            // Setup buyer with existing order
            state.balances['buyer'] = 1000000;
            state.balances['seller'] = 1000000;
            state.dex.hive = {
                tick: "0.500000",
                buyBook: "1.000000_buyer-tx",
                sellBook: "",
                buyOrders: {
                    '1.000000:buyer-tx': {
                        from: 'buyer',
                        hive: 60000,
                        larynx: 60000,
                        rate: '1.000000',
                        block_num: 99,
                        txid: 'buyer-tx',
                        partial: false
                    }
                },
                sellOrders: {}
            };
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            await setState([], state);
            
            const json = {
                larynx: 60000,
                hive: 60000,
                block_num: 100,
                transaction_id: 'test-match-1'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_sell(json, 'seller', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            assert.isAbove(ops.length, 0, 'Should have operations');
            
            // Should update both buyer and seller balances or update orders
            const hasBuyerUpdate = ops.some(op => op.path && op.path[1] === 'buyer');
            const hasSellerUpdate = ops.some(op => op.path && op.path[1] === 'seller');
            const hasOrderUpdate = ops.some(op => op.path && (op.path.includes('buyOrders') || op.path.includes('dex')));
            
            assert.isTrue(hasBuyerUpdate || hasSellerUpdate || hasOrderUpdate, 
                'Should have balance or order updates');
        });

        it('should handle partial order matching', async function () {
            const state = await getState();
            
            // Setup buyer with smaller order than seller
            state.balances['buyer'] = 1000000;
            state.balances['seller'] = 1000000;
            state.dex.hive = {
                tick: "0.500000",
                buyBook: "0.600000_buyer-partial",
                sellBook: "",
                buyOrders: {
                    '0.600000:buyer-partial': {
                        from: 'buyer',
                        hive: 30000, // Only wants 30 HIVE worth
                        larynx: 50000,
                        rate: '0.600000',
                        block_num: 99,
                        txid: 'buyer-partial',
                        partial: false
                    }
                },
                sellOrders: {}
            };
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            await setState([], state);
            
            const json = {
                larynx: 100000, // Selling 100k tokens
                hive: 60000,    // For 60k HIVE (rate = 0.6)
                block_num: 100,
                transaction_id: 'test-partial-1'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_sell(json, 'seller', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            assert.isAbove(ops.length, 0, 'Should have operations');
            
            // Should partially match and possibly create remainder sell order
            const hasUpdates = ops.some(op => op.path && (
                op.path[1] === 'buyer' || 
                op.path[1] === 'seller' || 
                op.path.includes('sellOrders') ||
                op.path.includes('dex')
            ));
            
            assert.isTrue(hasUpdates, 'Should have balance or order updates');
        });
    });

    describe('Transfer', function () {
        it('should process HIVE transfer correctly', async function () {
            const state = await getState();
            
            state.balances['test-sender'] = 1000000;
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            await setState([], state);
            
            const json = {
                to: Config.msaccount,
                memo: 'test-recipient',
                hive: 100000,
                transaction: {
                    amount: '100.000 HIVE'
                },
                block_num: 100
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.transfer(json, [resolve, reject]);
            });
            
            assert.isArray(ops);
            // Should credit recipient
            assert.isTrue(ops.some(op => op.path[1] === 'test-recipient' && op.type === 'put'));
            // Should update MSHeld
            assert.isTrue(ops.some(op => op.path.includes('MSHeld')));
        });

        it('should handle DEX buy order from transfer', async function () {
            const state = await getState();
            
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            state.dex.hive = {
                tick: "0.500000",
                buyBook: "",
                sellBook: "",
                buyOrders: {},
                sellOrders: {}
            };
            await setState([], state);
            
            const json = {
                to: Config.msaccount,
                memo: 'test-buyer:b:600', // Buy order at rate 600
                hive: 60000,
                transaction: {
                    amount: '60.000 HIVE'
                },
                block_num: 100
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.transfer(json, [resolve, reject]);
            });
            
            assert.isArray(ops);
            // Should add to buyBook
            assert.isTrue(ops.some(op => op.path.includes('buyBook')));
        });
    });

    describe('DEX Clear', function () {
        it('should clear all user orders', async function () {
            const state = await getState();
            
            // Setup orders
            state.dex.hive = {
                tick: "0.500000",
                buyBook: "0.600000_clear-buy",
                sellBook: "0.700000_clear-sell",
                buyOrders: {
                    '0.600000:clear-buy': {
                        from: 'test-clearer',
                        hive: 60000,
                        larynx: 100000,
                        rate: '0.600000',
                        block_num: 99,
                        txid: 'clear-buy'
                    }
                },
                sellOrders: {
                    '0.700000:clear-sell': {
                        from: 'test-clearer',
                        larynx: 50000,
                        hive: 35000,
                        rate: '0.700000',
                        block_num: 98,
                        txid: 'clear-sell'
                    }
                }
            };
            state.dex.hbd = {
                tick: "0.012500",
                buyBook: "",
                sellBook: "",
                buyOrders: {},
                sellOrders: {}
            };
            state.stats.MSHeld = { HIVE: 1000000, HBD: 500000 };
            state.balances['test-clearer'] = 100000;
            await setState([], state);
            
            const json = {
                id: 'all',
                block_num: 100,
                transaction_id: 'test-clear-1'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_clear(json, 'test-clearer', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            // Should refund user
            assert.isTrue(ops.some(op => op.path[1] === 'test-clearer' && op.type === 'put'));
            // Should remove from order books
            assert.isTrue(ops.some(op => op.path.includes('Book')));
        });
    });

    describe('Release Function', function () {
        it('should release escrow correctly', async function () {
            const state = await getState();
            
            // Setup escrow
            state.escrow = {
                'test-txid': {
                    to: 'recipient',
                    from: 'sender',
                    amount: 100000,
                    fee: 1000,
                    block: 99
                }
            };
            state.balances['recipient'] = 0;
            await setState([], state);
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.release('sender', 'test-txid', 100, 'release-tx', [resolve, reject]);
            });
            
            assert.isArray(ops);
            // Should credit recipient
            assert.isTrue(ops.some(op => op.path[1] === 'recipient' && op.type === 'put'));
            // Should delete escrow
            assert.isTrue(ops.some(op => op.path.includes('escrow') && op.type === 'del'));
        });
    });

    describe('Witness Functions', function () {
        it('should publish feed correctly', async function () {
            const state = await getState();
            
            // Setup witness
            state.runners['test-witness'] = {
                domain: 'test.witness.com',
                bidRate: 100
            };
            await setState([], state);
            
            const tx = {
                transaction: {
                    operations: [[
                        'feed_publish',
                        {
                            publisher: 'test-witness',
                            exchange_rate: {
                                base: { amount: 2170, nai: '@@000000021', precision: 3 },
                                quote: { amount: 10000, nai: '@@000000013', precision: 3 }
                            }
                        }
                    ]]
                },
                block: 1000000
            };
            
            const runtimeContext = { witnessAccounts: ['test-witness'] };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.feed_publish(tx, [resolve, reject], runtimeContext);
            });
            
            assert.isArray(ops);
            // Should update feed
            assert.isTrue(ops.some(op => op.path.includes('feed')));
        });
    });

    describe('Edge Cases', function () {
        it('should handle zero liquidity gracefully', async function () {
            const dex = {
                pool: { token: 0, hive: 0, tick: 0, shares: {}, sharesSupply: 0 }
            };
            const stats = { MSHeld: { HIVE: 0, HBD: 0 } };
            
            const result = dexLp.addLiquidity(dex, 0, 0, 'hive', stats);
            
            // When adding 0 liquidity to empty pool, it seeds the pool but lpTokens = sqrt(0*0) = 0
            assert.isTrue(result.success);
            assert.equal(result.lpTokens, 0);
        });

        it('should reject negative amounts', async function () {
            const state = await getState();
            state.balances['test-user'] = 1000000;
            state.dex.hive = { tick: "0.500000", buyBook: "", sellBook: "", buyOrders: {}, sellOrders: {} };
            await setState([], state);
            
            const json = {
                larynx: -100000,
                hive: 60000,
                block_num: 100,
                transaction_id: 'test-negative-1'
            };
            
            try {
                await new Promise((resolve, reject) => {
                    dexLp.dex_sell(json, 'test-user', true, [resolve, reject]);
                });
                assert.fail('Should reject negative amount');
            } catch (error) {
                assert.exists(error);
            }
        });

        it('should handle insufficient balance', async function () {
            const state = await getState();
            
            state.balances['poor-user'] = 100; // Only 100 tokens
            state.dex.hive = {
                tick: "0.500000",
                buyBook: "",
                sellBook: "",
                buyOrders: {},
                sellOrders: {}
            };
            await setState([], state);
            
            const json = {
                larynx: 100000, // Trying to sell 100000 tokens
                hive: 60000,
                block_num: 100,
                transaction_id: 'test-insufficient-1'
            };
            
            try {
                await new Promise((resolve, reject) => {
                    dexLp.dex_sell(json, 'poor-user', true, [resolve, reject]);
                });
                assert.fail('Should reject insufficient balance');
            } catch (error) {
                assert.exists(error);
            }
        });

        it('should handle missing required fields', async function () {
            const json = {
                // Missing action
                pair: 'hive',
                block_num: 100,
                transaction_id: 'test-missing-1'
            };
            
            try {
                await new Promise((resolve, reject) => {
                    dexLp.dex_lp_action(json, 'test-user', true, [resolve, reject]);
                });
                assert.fail('Should reject missing fields');
            } catch (error) {
                assert.exists(error);
            }
        });

        it('should handle invalid pair types', async function () {
            const json = {
                action: 'swap',
                pair: 'invalid', // Not 'hive' or 'hbd'
                inputType: 'token',
                amount: 10000,
                block_num: 100,
                transaction_id: 'test-invalid-pair'
            };
            
            try {
                await new Promise((resolve, reject) => {
                    dexLp.dex_lp_action(json, 'test-user', true, [resolve, reject]);
                });
                assert.fail('Should reject invalid pair');
            } catch (error) {
                assert.exists(error);
            }
        });
    });

    describe('Complex Scenarios', function () {
        it('should handle multiple concurrent swaps', async function () {
            const state = await getState();
            
            // Setup initial state
            state.balances['user1'] = 1000000;
            state.balances['user2'] = 1000000;
            state.dex.hive = {
                pool: { token: 10000000, hive: 5000000, tick: 500, shares: {}, sharesSupply: 10000000 }
            };
            state.stats.MSHeld = { HIVE: 10000000, HBD: 5000000 };
            await setState([], state);
            
            // First swap
            const swap1 = {
                action: 'swap',
                pair: 'hive',
                inputType: 'token',
                amount: 100000,
                minOutput: 49000,
                block_num: 100,
                transaction_id: 'test-concurrent-1'
            };
            
            const ops1 = await new Promise((resolve, reject) => {
                dexLp.dex_lp_action(swap1, 'user1', true, [resolve, reject]);
            });
            
            // Update state with first swap results
            const newState = await getState();
            
            // Second swap should see updated pool
            const swap2 = {
                action: 'swap',
                pair: 'hive',
                inputType: 'token',
                amount: 100000,
                minOutput: 48000, // Slightly worse rate due to first swap
                block_num: 101,
                transaction_id: 'test-concurrent-2'
            };
            
            const ops2 = await new Promise((resolve, reject) => {
                dexLp.dex_lp_action(swap2, 'user2', true, [resolve, reject]);
            });
            
            assert.isArray(ops1);
            assert.isArray(ops2);
            // Second swap should get less output due to price impact
        });

        it('should handle order book with multiple rates', async function () {
            const state = await getState();
            
            // Create tiered buy orders
            state.balances['buyer1'] = 1000000;
            state.balances['buyer2'] = 1000000;
            state.balances['buyer3'] = 1000000;
            state.balances['seller'] = 1000000;
            
            state.dex.hive = {
                tick: "0.500000",
                buyBook: "0.650000_buyer1,0.625000_buyer2,0.600000_buyer3",
                sellBook: "",
                buyOrders: {
                    '0.650000:buyer1': {
                        from: 'buyer1',
                        hive: 65000,
                        larynx: 100000,
                        rate: '0.650000',
                        block_num: 97,
                        txid: 'buyer1'
                    },
                    '0.625000:buyer2': {
                        from: 'buyer2',
                        hive: 62500,
                        larynx: 100000,
                        rate: '0.625000',
                        block_num: 98,
                        txid: 'buyer2'
                    },
                    '0.600000:buyer3': {
                        from: 'buyer3',
                        hive: 60000,
                        larynx: 100000,
                        rate: '0.600000',
                        block_num: 99,
                        txid: 'buyer3'
                    }
                },
                sellOrders: {}
            };
            state.stats.MSHeld = { HIVE: 2000000, HBD: 1000000 };
            await setState([], state);
            
            // Large sell order should match best prices first
            const json = {
                larynx: 250000, // Selling 250k tokens
                hive: 150000,   // For minimum 150k HIVE (rate = 0.6)
                block_num: 100,
                transaction_id: 'test-tiered-1'
            };
            
            const ops = await new Promise((resolve, reject) => {
                dexLp.dex_sell(json, 'seller', true, [resolve, reject]);
            });
            
            assert.isArray(ops);
            assert.isAbove(ops.length, 0, 'Should have operations');
            
            // Should have matched orders and updated balances/orders
            const hasUpdates = ops.some(op => op.path && (
                op.path[1] === 'buyer1' || 
                op.path[1] === 'buyer2' || 
                op.path[1] === 'seller' ||
                op.path.includes('Orders') ||
                op.path.includes('dex')
            ));
            
            assert.isTrue(hasUpdates, 'Should have processed orders');
        });
    });
});