import { assert } from 'chai';
import { send, claim } from './../processing_routes/send.js';
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
        setTimeout(() => resolve(pc[2]), 100);
    });
}

// Mock Config function
global.Config = (key) => {
    const config = {
        'TOKEN': 'LARYNX',
        'hookurl': false,
        'status': false,
        'dbcs': false
    };
    return config[key];
};

// Mock postToDiscord
global.postToDiscord = () => {};

// Mock updatePromote
global.updatePromote = () => {};

function init() {
    return new Promise((resolve, reject) => {
        store.del([], function (e) {
            if (e) { console.log(e) }
            // Add token-specific test data
            const tokenTestState = {
                ...test_state,
                balances: {
                    'alice': 50000000,    // 50 tokens
                    'bob': 30000000,      // 30 tokens
                    'charlie': 10000000,  // 10 tokens
                    'david': 5000000,     // 5 tokens
                    'null': 0,            // Promotion sink
                    'eve': 0              // Empty account
                },
                cbalances: {
                    'alice': 20000000,    // 20 claimable tokens
                    'bob': 10000000,      // 10 claimable tokens
                    'charlie': 0          // No claimable tokens
                },
                pow: {
                    'alice': 15000000,    // 15 powered tokens
                    'bob': 5000000,       // 5 powered tokens
                    't': 100000000        // 100 total powered
                },
                gov: {
                    'alice': 8000000,     // 8 governance tokens
                    'bob': 2000000,       // 2 governance tokens
                    't': 50000000         // 50 total governance
                },
                claim: {
                    'alice': 1234567890,  // Last claim block
                    'bob': 1234560000     // Last claim block
                }
            }
            store.put([], tokenTestState, function (err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

describe('Token Operations', function () {
    this.timeout(10000);
    
    beforeEach(function () {
        return init();
    });

    describe('send - Token Transfers', function () {
        it('Should transfer tokens between accounts', () => {
            let json = {
                to: 'bob',
                amount: 5000000, // 5 tokens
                block_num: 10000,
                transaction_id: 'test_send_1'
            }
            return callOp(send, json, 'alice')
            .then(ops => {
                assert.isArray(ops)
                
                // Check sender balance reduction
                let fromOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'alice'
                )
                assert.equal(fromOp.data, 50000000 - 5000000)
                
                // Check receiver balance increase
                let toOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'bob'
                )
                assert.equal(toOp.data, 30000000 + 5000000)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Sent @bob 5.000 LARYNX')
            })
        })

        it('Should handle promotion transfers to null', () => {
            let json = {
                to: 'null',
                amount: 1000000, // 1 token
                memo: '@alice/awesome-post',
                block_num: 11000,
                transaction_id: 'test_promote'
            }
            return callOp(send, json, 'charlie')
            .then(ops => {
                assert.isArray(ops)
                
                // Check sender balance reduction
                let fromOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'charlie'
                )
                assert.equal(fromOp.data, 10000000 - 1000000)
                
                // Check null balance increase
                let toOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'null'
                )
                assert.equal(toOp.data, 0 + 1000000)
                
                // Check promotion message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Promoted @alice/awesome-post with 1.000 LARYNX')
            })
        })

        it('Should reject transfer with insufficient balance', () => {
            let json = {
                to: 'bob',
                amount: 100000000, // 100 tokens (more than alice has)
                block_num: 12000,
                transaction_id: 'test_send_poor'
            }
            return callOp(send, json, 'alice')
            .then(ops => {
                assert.isArray(ops)
                // Should only have invalid operation message
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid send operation')
            })
        })

        it('Should reject negative amount transfers', () => {
            let json = {
                to: 'bob',
                amount: -1000000, // Negative amount
                block_num: 13000,
                transaction_id: 'test_send_negative'
            }
            return callOp(send, json, 'alice')
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid send operation')
            })
        })

        it('Should reject self-transfers', () => {
            let json = {
                to: 'alice',
                amount: 1000000,
                block_num: 14000,
                transaction_id: 'test_send_self'
            }
            return callOp(send, json, 'alice')
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid send operation')
            })
        })

        it('Should validate username format', () => {
            let json = {
                to: 'invalid user!', // Invalid username
                amount: 1000000,
                block_num: 15000,
                transaction_id: 'test_send_invalid_user'
            }
            return callOp(send, json, 'alice')
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid send operation')
            })
        })

        it('Should handle transfers to new accounts', () => {
            let json = {
                to: 'eve', // Account with 0 balance
                amount: 2000000, // 2 tokens
                block_num: 16000,
                transaction_id: 'test_send_new'
            }
            return callOp(send, json, 'bob')
            .then(ops => {
                assert.isArray(ops)
                
                // Check eve's balance increase from 0
                let toOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'eve'
                )
                assert.equal(toOp.data, 0 + 2000000)
            })
        })
    });

    describe('claim - Claim Rewards', function () {
        it('Should claim rewards and split between liquid and power', () => {
            let json = {
                gov: false, // Power up half
                block_num: 20000,
                transaction_id: 'test_claim_power'
            }
            return callOp(claim, json, 'alice')
            .then(ops => {
                assert.isArray(ops)
                
                // Check claimable balance deleted
                let delOp = ops.find(op => 
                    op.type === 'del' && 
                    op.path[0] === 'cbalances' && 
                    op.path[1] === 'alice'
                )
                assert.exists(delOp)
                
                // Check liquid balance increase (half of 20M = 10M)
                let balOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'alice'
                )
                assert.equal(balOp.data, 50000000 + 10000000)
                
                // Check power increase (other half = 10M)
                let powOp = ops.find(op => 
                    op.path[0] === 'pow' && 
                    op.path[1] === 'alice'
                )
                assert.equal(powOp.data, 15000000 + 10000000)
                
                // Check total power increase
                let totPowOp = ops.find(op => 
                    op.path[0] === 'pow' && 
                    op.path[1] === 't'
                )
                assert.equal(totPowOp.data, 100000000 + 10000000)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Claimed 20.000 LARYNX - Half powered up')
            })
        })

        it('Should claim rewards to governance', () => {
            let json = {
                gov: true, // Lock in governance
                block_num: 21000,
                transaction_id: 'test_claim_gov'
            }
            return callOp(claim, json, 'bob')
            .then(ops => {
                assert.isArray(ops)
                
                // Check liquid balance increase (half of 10M = 5M)
                let balOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'bob'
                )
                assert.equal(balOp.data, 30000000 + 5000000)
                
                // Check governance increase (other half = 5M)
                let govOp = ops.find(op => 
                    op.path[0] === 'gov' && 
                    op.path[1] === 'bob'
                )
                assert.equal(govOp.data, 2000000 + 5000000)
                
                // Check total governance increase
                let totGovOp = ops.find(op => 
                    op.path[0] === 'gov' && 
                    op.path[1] === 't'
                )
                assert.equal(totGovOp.data, 50000000 + 5000000)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Claimed 10.000 LARYNX - Half locked in gov')
            })
        })

        it('Should reject claim with no claimable balance', () => {
            let json = {
                gov: false,
                block_num: 22000,
                transaction_id: 'test_claim_empty'
            }
            return callOp(claim, json, 'charlie') // Has 0 claimable
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid claim operation')
            })
        })

        it('Should handle claims for accounts without power/gov entries', () => {
            // Test claim for account with claimable but no pow/gov entries
            return new Promise((resolve, reject) => {
                const setupOps = [
                    {
                        type: 'put',
                        path: ['cbalances', 'david'],
                        data: 8000000 // 8 claimable tokens
                    },
                    {
                        type: 'del',
                        path: ['pow', 'david']
                    },
                    {
                        type: 'del',
                        path: ['gov', 'david']
                    }
                ];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    gov: false,
                    block_num: 23000,
                    transaction_id: 'test_claim_new_power'
                }
                return callOp(claim, json, 'david')
            })
            .then(ops => {
                assert.isArray(ops)
                
                // Should create new power entry
                let powOp = ops.find(op => 
                    op.path[0] === 'pow' && 
                    op.path[1] === 'david'
                )
                assert.equal(powOp.data, 0 + 4000000) // Half of 8M
            })
        })
    });

    describe('Edge Cases and Security', function () {
        it('Should handle maximum precision amounts', () => {
            let json = {
                to: 'bob',
                amount: 1, // 0.001 token (minimum unit)
                block_num: 30000,
                transaction_id: 'test_min_send'
            }
            return callOp(send, json, 'alice')
            .then(ops => {
                assert.isArray(ops)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, '0.001 LARYNX')
            })
        })

        it('Should handle concurrent transfers correctly', () => {
            // Multiple transfers from same account
            const transfers = [
                { to: 'bob', amount: 1000000 },
                { to: 'charlie', amount: 2000000 },
                { to: 'david', amount: 3000000 }
            ];
            
            return Promise.all(transfers.map((transfer, index) => {
                let json = {
                    ...transfer,
                    block_num: 31000 + index,
                    transaction_id: `test_concurrent_${index}`
                }
                return callOp(send, json, 'alice')
            }))
            .then(results => {
                // All should succeed
                results.forEach(ops => {
                    assert.isArray(ops)
                    assert.isAbove(ops.length, 2) // Should have from, to, and feed ops
                })
                
                // Total sent: 6M, alice started with 50M
                let finalFromOp = results[2].find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'alice'
                )
                assert.equal(finalFromOp.data, 50000000 - 3000000) // Last transfer amount
            })
        })

        it('Should handle exact balance transfers', () => {
            let json = {
                to: 'alice',
                amount: 5000000, // David's exact balance
                block_num: 32000,
                transaction_id: 'test_exact_balance'
            }
            return callOp(send, json, 'david')
            .then(ops => {
                assert.isArray(ops)
                
                // David should have 0 balance
                let fromOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'david'
                )
                assert.equal(fromOp.data, 0)
            })
        })

        it('Should properly escape usernames in promotion', () => {
            let json = {
                to: 'null',
                amount: 100000,
                memo: 'alice/post-with-special-chars',
                block_num: 33000,
                transaction_id: 'test_promote_escape'
            }
            return callOp(send, json, 'bob')
            .then(ops => {
                assert.isArray(ops)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Promoted @alice/post-with-special-chars')
            })
        })

        it('Should handle inactive send operations', () => {
            let json = {
                to: 'bob',
                amount: 1000000,
                block_num: 34000,
                transaction_id: 'test_inactive'
            }
            return callOp(send, json, 'alice', false) // active = false
            .then(ops => {
                assert.isArray(ops)
                assert.equal(ops.length, 1)
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Invalid send operation')
            })
        })
    });
});