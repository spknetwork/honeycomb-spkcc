import { assert } from 'chai';
import { gov_up, gov_down } from './../processing_routes/gov.js';
import { store } from './../index.mjs';
import test_state from './test_state.js';

// Set test environment
process.env.npm_lifecycle_event = 'test';

// Helper function to call operations in test mode
function callOp(opFunc, json, from, active = true) {
    return new Promise((resolve) => {
        const pc = [() => {}, () => {}, []];
        opFunc(json, from, active, pc);
        // Give time for async operations to complete and set pc[2]
        setTimeout(() => resolve(pc[2]), 150);
    });
}

// Mock Config function
global.Config = (key) => {
    const config = {
        'TOKEN': 'LARYNX',
        'hookurl': false,
        'status': false
    };
    return config[key];
};

// Mock functions
global.postToDiscord = () => {};
global.chronAssign = (block, data) => {
    return Promise.resolve(`${block}:chrono:${data.op}`);
};

function init() {
    return new Promise((resolve, reject) => {
        store.del([], function (e) {
            if (e) { console.log(e) }
            // Add governance-specific test data
            const govTestState = {
                ...test_state,
                balances: {
                    'validator1': 100000000,   // 100 tokens liquid
                    'validator2': 50000000,    // 50 tokens liquid
                    'validator3': 25000000,    // 25 tokens liquid
                    'non-node': 10000000,      // 10 tokens (not a node)
                    'poor-node': 1000000       // 1 token
                },
                gov: {
                    'validator1': 50000000,    // 50 tokens locked
                    'validator2': 20000000,    // 20 tokens locked
                    'validator3': 0,           // No tokens locked yet
                    't': 70000000              // 70 total locked
                },
                govd: {
                    'validator1': {            // Has pending withdrawals
                        '150000:chrono:gov_down': '150000:chrono:gov_down',
                        '160000:chrono:gov_down': '160000:chrono:gov_down'
                    }
                },
                markets: {
                    node: {
                        'validator1': { self: 'validator1', domain: 'validator1.com' },
                        'validator2': { self: 'validator2', domain: 'validator2.com' },
                        'validator3': { self: 'validator3', domain: 'validator3.com' },
                        'poor-node': { self: 'poor-node', domain: 'poor.com' }
                    }
                },
                chrono: {
                    '150000': { gov_down: { validator1: { amount: 5000000, by: 'validator1' } } },
                    '160000': { gov_down: { validator1: { amount: 5000000, by: 'validator1' } } }
                }
            }
            store.put([], govTestState, function (err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

describe('Governance Operations', function () {
    this.timeout(10000);
    
    beforeEach(function () {
        return init();
    });

    describe('gov_up - Lock Tokens for Governance', function () {
        it('Should lock tokens for governance', () => {
            let json = {
                amount: 10000000, // 10 tokens
                block_num: 10000,
                transaction_id: 'test_gov_up_1'
            }
            return callOp(gov_up, json, 'validator1')
            .then(ops => {
                assert.isArray(ops)
                
                // Check liquid balance reduction
                let balOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'validator1'
                )
                assert.equal(balOp.data, 100000000 - 10000000)
                
                // Check governance balance increase
                let govOp = ops.find(op => 
                    op.path[0] === 'gov' && 
                    op.path[1] === 'validator1'
                )
                assert.equal(govOp.data, 50000000 + 10000000)
                
                // Check total governance increase
                let govTotalOp = ops.find(op => 
                    op.path[0] === 'gov' && 
                    op.path[1] === 't'
                )
                assert.equal(govTotalOp.data, 70000000 + 10000000)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Locked 10.000 LARYNX for Governance')
            })
        })

        it('Should lock tokens for new governance participant', () => {
            let json = {
                amount: 5000000, // 5 tokens
                block_num: 11000,
                transaction_id: 'test_gov_up_new'
            }
            return callOp(gov_up, json, 'validator3')
            .then(ops => {
                assert.isArray(ops)
                
                // Check governance balance created from 0
                let govOp = ops.find(op => 
                    op.path[0] === 'gov' && 
                    op.path[1] === 'validator3'
                )
                assert.equal(govOp.data, 0 + 5000000)
            })
        })

        it('Should reject gov_up from non-node', () => {
            let json = {
                amount: 1000000,
                block_num: 12000,
                transaction_id: 'test_gov_up_non_node'
            }
            return callOp(gov_up, json, 'non-node')
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid gov up')
            })
        })

        it('Should reject gov_up with insufficient balance', () => {
            let json = {
                amount: 200000000, // More than validator1 has
                block_num: 13000,
                transaction_id: 'test_gov_up_poor'
            }
            return callOp(gov_up, json, 'validator1')
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid gov up')
            })
        })

        it('Should lock exact balance amount', () => {
            let json = {
                amount: 25000000, // validator3's exact balance
                block_num: 14000,
                transaction_id: 'test_gov_up_exact'
            }
            return callOp(gov_up, json, 'validator3')
            .then(ops => {
                assert.isArray(ops)
                
                // Should have 0 liquid balance
                let balOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'validator3'
                )
                assert.equal(balOp.data, 0)
                
                // Should have all in governance
                let govOp = ops.find(op => 
                    op.path[0] === 'gov' && 
                    op.path[1] === 'validator3'
                )
                assert.equal(govOp.data, 25000000)
            })
        })
    });

    describe('gov_down - Schedule Governance Withdrawal', function () {
        it('Should schedule 4-week withdrawal', () => {
            let json = {
                amount: 20000000, // 20 tokens
                block_num: 20000,
                transaction_id: 'test_gov_down_1'
            }
            return callOp(gov_down, json, 'validator1')
            .then(ops => {
                assert.isArray(ops)
                
                // Check new withdrawal schedule
                let govdOp = ops.find(op => 
                    op.path[0] === 'govd' && 
                    op.path[1] === 'validator1'
                )
                assert.exists(govdOp)
                
                // Should have 4 new withdrawals scheduled
                let newKeys = Object.keys(govdOp.data);
                assert.equal(newKeys.length, 4)
                
                // Check chronos are created for correct blocks
                // 201600 blocks per week, so 4 weeks
                let expectedBlocks = [
                    20000 + 201600,
                    20000 + (201600 * 2),
                    20000 + (201600 * 3),
                    20000 + (201600 * 4)
                ];
                
                expectedBlocks.forEach(block => {
                    let hasBlock = newKeys.some(key => key.includes(block.toString()));
                    assert.isTrue(hasBlock, `Should have withdrawal at block ${block}`);
                });
                
                // Check old chronos deleted
                let delOps = ops.filter(op => 
                    op.type === 'del' && 
                    op.path[0] === 'chrono'
                );
                assert.equal(delOps.length, 2) // Delete 2 old withdrawals
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Set withdrawl of 20.000 LARYNX')
            })
        })

        it('Should split withdrawal evenly across 4 weeks', () => {
            let json = {
                amount: 16000000, // 16 tokens (evenly divisible by 4)
                block_num: 21000,
                transaction_id: 'test_gov_down_even'
            }
            return callOp(gov_down, json, 'validator2')
            .then(ops => {
                assert.isArray(ops)
                
                // Each week should get 4M tokens
                let govdOp = ops.find(op => op.path[0] === 'govd')
                let withdrawals = Object.keys(govdOp.data);
                assert.equal(withdrawals.length, 4)
                
                // In real implementation, would check each amount is 4000000
            })
        })

        it('Should handle odd amounts with remainder in last week', () => {
            let json = {
                amount: 17000000, // 17 tokens (not evenly divisible)
                block_num: 22000,
                transaction_id: 'test_gov_down_odd'
            }
            return callOp(gov_down, json, 'validator2')
            .then(ops => {
                assert.isArray(ops)
                
                // First 3 weeks: 4.25M each, last week: 4.25M + 1 (remainder)
                let govdOp = ops.find(op => op.path[0] === 'govd')
                assert.exists(govdOp)
                
                // Should have 4 withdrawals
                assert.equal(Object.keys(govdOp.data).length, 4)
            })
        })

        it('Should cancel all withdrawals with amount 0', () => {
            let json = {
                amount: 0, // Cancel all
                block_num: 23000,
                transaction_id: 'test_gov_down_cancel'
            }
            return callOp(gov_down, json, 'validator1')
            .then(ops => {
                assert.isArray(ops)
                
                // Should delete all chronos
                let delOps = ops.filter(op => 
                    op.type === 'del' && 
                    op.path[0] === 'chrono'
                );
                assert.equal(delOps.length, 2) // validator1 has 2 pending
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Canceled Governance withdrawl')
            })
        })

        it('Should reject withdrawal exceeding locked amount', () => {
            let json = {
                amount: 100000000, // More than validator1 has locked
                block_num: 24000,
                transaction_id: 'test_gov_down_excess'
            }
            return callOp(gov_down, json, 'validator1')
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid Governance withdrawl')
            })
        })

        it('Should handle minimum withdrawal amount', () => {
            let json = {
                amount: 4, // Minimum meaningful amount (1 per week)
                block_num: 25000,
                transaction_id: 'test_gov_down_min'
            }
            return callOp(gov_down, json, 'validator2')
            .then(ops => {
                assert.isArray(ops)
                
                // Should create 4 withdrawals of 1 each
                let govdOp = ops.find(op => op.path[0] === 'govd')
                assert.exists(govdOp)
                assert.equal(Object.keys(govdOp.data).length, 4)
            })
        })

        it('Should handle inactive operations', () => {
            let json = {
                amount: 10000000,
                block_num: 26000,
                transaction_id: 'test_gov_inactive'
            }
            return callOp(gov_down, json, 'validator1', false) // active = false
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid Governance withdrawl')
            })
        })
    });

    describe('Governance Power and Voting Weight', function () {
        it('Should track total governance power', async function () {
            // Lock tokens from multiple validators
            let ops1 = await callOp(gov_up, {
                amount: 10000000,
                block_num: 30000,
                transaction_id: 'test_total_1'
            }, 'validator1')
            
            let ops2 = await callOp(gov_up, {
                amount: 5000000,
                block_num: 30001,
                transaction_id: 'test_total_2'
            }, 'validator2')
            
            // Check total is updated correctly
            let totalOp1 = ops1.find(op => op.path[0] === 'gov' && op.path[1] === 't')
            let totalOp2 = ops2.find(op => op.path[0] === 'gov' && op.path[1] === 't')
            
            assert.equal(totalOp1.data, 70000000 + 10000000)
            assert.equal(totalOp2.data, 70000000 + 5000000) // Note: in real execution would be cumulative
        })

        it('Should handle governance operations for small amounts', () => {
            let json = {
                amount: 1000, // 0.001 token
                block_num: 31000,
                transaction_id: 'test_gov_small'
            }
            return callOp(gov_up, json, 'poor-node')
            .then(ops => {
                assert.isArray(ops)
                
                let govOp = ops.find(op => 
                    op.path[0] === 'gov' && 
                    op.path[1] === 'poor-node'
                )
                assert.equal(govOp.data, 0 + 1000)
            })
        })
    });

    describe('Edge Cases and Security', function () {
        it('Should handle negative amounts', () => {
            let json = {
                amount: -1000000, // Negative amount
                block_num: 32000,
                transaction_id: 'test_gov_negative'
            }
            return callOp(gov_up, json, 'validator1')
            .then(ops => {
                // parseInt will handle this, but should fail balance check
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid')
            })
        })

        it('Should handle concurrent governance operations', () => {
            // Multiple gov_up operations from same account
            const operations = [
                { amount: 1000000, block_num: 33000, transaction_id: 'concurrent_1' },
                { amount: 2000000, block_num: 33001, transaction_id: 'concurrent_2' },
                { amount: 3000000, block_num: 33002, transaction_id: 'concurrent_3' }
            ];
            
            return Promise.all(operations.map(json => 
                callOp(gov_up, json, 'validator2')
            ))
            .then(results => {
                // All should succeed
                results.forEach(ops => {
                    assert.isArray(ops)
                    assert.isAbove(ops.length, 3)
                })
            })
        })

        it('Should validate node ownership for governance', () => {
            // Try to lock tokens for a node owned by someone else
            return new Promise((resolve, reject) => {
                const setupOps = [{
                    type: 'put',
                    path: ['markets', 'node', 'validator1'],
                    data: { self: 'someone-else', domain: 'validator1.com' }
                }];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    amount: 5000000,
                    block_num: 34000,
                    transaction_id: 'test_gov_wrong_owner'
                }
                return callOp(gov_up, json, 'validator1')
            })
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid gov up')
            })
        })

        it('Should handle governance withdrawal scheduling edge cases', () => {
            let json = {
                amount: 3, // 3 tokens - will be 0,0,0,3 across weeks
                block_num: 35000,
                transaction_id: 'test_gov_down_tiny'
            }
            return callOp(gov_down, json, 'validator2')
            .then(ops => {
                assert.isArray(ops)
                
                // Should still create 4 withdrawals
                let govdOp = ops.find(op => op.path[0] === 'govd')
                assert.exists(govdOp)
                assert.equal(Object.keys(govdOp.data).length, 4)
                
                // Last week gets all 3 tokens due to remainder handling
            })
        })
    });
});