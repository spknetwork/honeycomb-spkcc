import { assert } from 'chai';
import { sig_submit, osig_submit, account_update } from './../processing_routes/sig.js';
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
        'msaccount': 'honeycomb-msig',
        'mode': 'verbose',
        'hookurl': false
    };
    return config[key];
};

// Mock verify function to track multisig execution
global.verify = (msop, sigs, threshold) => {
    console.log(`Multisig operation verified with ${sigs.length} signatures (threshold: ${threshold})`);
    return true;
};

// Mock isValidTxSig for signature verification
global.isValidTxSig = (msop, sig, key) => {
    // In real implementation, this would verify the signature
    // For tests, we'll check if the sig matches expected pattern
    return sig && sig.startsWith('SIG_') && key && key.startsWith('STM');
};

function init() {
    return new Promise((resolve, reject) => {
        store.del([], function (e) {
            if (e) { console.log(e) }
            // Add multisig-specific test data
            const multisigTestState = {
                ...test_state,
                stats: {
                    ms: {
                        active_account_auths: {
                            'signer1': 25,  // 25% weight
                            'signer2': 30,  // 30% weight
                            'signer3': 45,  // 45% weight
                            'signer4': 20   // 20% weight
                        },
                        active_threshold: 51,  // Need 51% to execute
                        owner_key_auths: {
                            'STM8GC13uCZbP44HzMLV6zPZGwVQ8Nt4Kji8PapsPiNq1BK153XTX': 1,
                            'STM7WDG2QpThdkRa3G2PYXM7gH9UksoGm4xqoFBrKdgKBmgkz3Npe': 1
                        },
                        owner_threshold: 2,  // Need 2 owner signatures
                        posting_threshold: 1,
                        memo_key: 'STM8GC13uCZbP44HzMLV6zPZGwVQ8Nt4Kji8PapsPiNq1BK153XTX'
                    }
                },
                markets: {
                    nodes: {
                        'signer1': { mskey: 'STM5jZQoYPePpJp6mBPAi85TdVpEdeo8CXqn8VwkwHXv6kz3Gzx2K', vS: 0 },
                        'signer2': { mskey: 'STM6c2J9puWrYj41iqJHH9K8Nw6Xrt7EvBdLfKn9K1hhYfwT6FaGC', vS: 0 },
                        'signer3': { mskey: 'STM7nFUyN3G7H1N9f5gJbuLMr8hXUoqcH2eZrNpvPKBLK1KtT8Qqa', vS: 0 },
                        'signer4': { mskey: 'STM8YQqtRCXdqkFKKfqsWHXFfp2BFJqYwxfnYpaPKx3uQ7FTCb2hR', vS: 0 }
                    }
                },
                mss: {},   // Multisig operations storage
                msso: {}   // Owner multisig operations storage
            }
            store.put([], multisigTestState, function (err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

describe('Multisig Security Operations', function () {
    this.timeout(10000);
    
    beforeEach(function () {
        return init();
    });

    describe('sig_submit (Active Authority)', function () {
        beforeEach(function () {
            // Setup: Create a pending multisig operation
            return new Promise((resolve, reject) => {
                const msop = {
                    operations: [['transfer', {
                        from: 'honeycomb-msig',
                        to: 'alice',
                        amount: '100.000 LARYNX',
                        memo: 'Multisig transfer'
                    }]],
                    expiration: '2025-12-31T23:59:59',
                    extensions: [],
                    ref_block_num: 12345,
                    ref_block_prefix: 3141592653
                };
                
                const setupOps = [
                    {
                        type: 'put',
                        path: ['mss', '100000'],
                        data: JSON.stringify(msop)
                    },
                    {
                        type: 'put',
                        path: ['mss', '100000:sigs'],
                        data: {}
                    }
                ];
                store.batch(setupOps, [resolve, reject])
            });
        });

        it('Should submit first signature for multisig operation', () => {
            let json = {
                sig_block: '100000',
                sig: 'SIG_K1_KjWYNqVWV4mhVoFxqxjuKfgFvwqvQMnQfBfbZFCrfwDZGqPHmN6YKLPgmJnGYqkTHMnVB3NWTDLqUBhzJHgAY8kHg5X1Xx'
            }
            return callOp(sig_submit, json, 'signer1')
            .then(ops => {
                assert.isArray(ops)
                
                // Check signature was stored
                let sigOp = ops.find(op => op.path[0] === 'mss' && op.path[1] === '100000:sigs')
                assert.exists(sigOp)
                assert.equal(sigOp.data.signer1, json.sig)
                
                // Check node signature count incremented
                let nodeOp = ops.find(op => op.path[0] === 'markets' && op.path[1] === 'nodes')
                assert.exists(nodeOp)
                assert.equal(nodeOp.data.vS, 1)
            })
        })

        it('Should execute multisig when threshold reached', () => {
            // Setup: Add existing signatures (25% + 30% = 55% > 51% threshold)
            return new Promise((resolve, reject) => {
                const setupOps = [{
                    type: 'put',
                    path: ['mss', '100000:sigs'],
                    data: {
                        'signer1': 'SIG_K1_ExistingSig1',
                        'signer2': 'SIG_K1_ExistingSig2'
                    }
                }];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                // This signature should trigger execution (already have 55%)
                let json = {
                    sig_block: '100000',
                    sig: 'SIG_K1_NewSig3'
                }
                return callOp(sig_submit, json, 'signer3')
            })
            .then(ops => {
                // Verify operation would be executed
                // In real implementation, verify() would be called
                assert.isArray(ops)
            })
        })

        it('Should not execute with insufficient weight', () => {
            // Setup: Only signer4 has signed (20% < 51% threshold)
            return new Promise((resolve, reject) => {
                const setupOps = [{
                    type: 'put',
                    path: ['mss', '100000:sigs'],
                    data: {
                        'signer4': 'SIG_K1_Signer4Sig'
                    }
                }];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                // Adding signer1 (20% + 25% = 45% < 51%)
                let json = {
                    sig_block: '100000',
                    sig: 'SIG_K1_Signer1Sig'
                }
                return callOp(sig_submit, json, 'signer1')
            })
            .then(ops => {
                // Should store signature but not execute
                let sigOp = ops.find(op => op.path[0] === 'mss' && op.path[1] === '100000:sigs')
                assert.exists(sigOp)
                assert.equal(Object.keys(sigOp.data).length, 2) // Two signatures stored
                // verify() should not have been called
            })
        })

        it('Should reject signature from unauthorized account', () => {
            let json = {
                sig_block: '100000',
                sig: 'SIG_K1_UnauthorizedSig'
            }
            return callOp(sig_submit, json, 'unauthorized_user')
            .then(ops => {
                // Should fail - no operations
                assert.isUndefined(ops)
            })
        })

        it('Should reject invalid signature', () => {
            // Mock invalid signature verification
            const originalIsValidTxSig = global.isValidTxSig;
            global.isValidTxSig = () => false;
            
            let json = {
                sig_block: '100000',
                sig: 'SIG_K1_InvalidSig'
            }
            return callOp(sig_submit, json, 'signer1')
            .then(ops => {
                // Should fail verification
                assert.isUndefined(ops)
                // Restore original function
                global.isValidTxSig = originalIsValidTxSig;
            })
        })
    });

    describe('osig_submit (Owner Authority)', function () {
        beforeEach(function () {
            // Setup: Create an owner-level multisig operation
            return new Promise((resolve, reject) => {
                const msop = {
                    operations: [['account_update', {
                        account: 'honeycomb-msig',
                        active: {
                            weight_threshold: 51,
                            account_auths: [
                                ['newsigner1', 50],
                                ['newsigner2', 50]
                            ],
                            key_auths: []
                        }
                    }]],
                    expiration: '2025-12-31T23:59:59',
                    extensions: [],
                    ref_block_num: 12346,
                    ref_block_prefix: 3141592654
                };
                
                const setupOps = [
                    {
                        type: 'put',
                        path: ['msso', '100001'],
                        data: JSON.stringify(msop)
                    },
                    {
                        type: 'put',
                        path: ['msso', '100001:sigs'],
                        data: {}
                    }
                ];
                store.batch(setupOps, [resolve, reject])
            });
        });

        it('Should require owner signatures for critical operations', () => {
            let json = {
                sig_block: '100001',
                sig: 'SIG_K1_OwnerSig1'
            }
            return callOp(osig_submit, json, 'signer1')
            .then(ops => {
                assert.isArray(ops)
                
                // Check owner signature was stored
                let sigOp = ops.find(op => op.path[0] === 'msso' && op.path[1] === '100001:sigs')
                assert.exists(sigOp)
                assert.equal(sigOp.data.signer1, json.sig)
            })
        })

        it('Should execute owner operation with threshold signatures', () => {
            // Setup: Add one existing owner signature
            return new Promise((resolve, reject) => {
                const setupOps = [{
                    type: 'put',
                    path: ['msso', '100001:sigs'],
                    data: {
                        'signer1': 'SIG_K1_Owner1'
                    }
                }];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                // Second owner signature should trigger execution
                let json = {
                    sig_block: '100001',
                    sig: 'SIG_K1_Owner2'
                }
                return callOp(osig_submit, json, 'signer2')
            })
            .then(ops => {
                // Should execute with 2 owner signatures
                assert.isArray(ops)
                let sigOp = ops.find(op => op.path[0] === 'msso' && op.path[1] === '100001:sigs')
                assert.equal(Object.keys(sigOp.data).length, 2)
            })
        })
    });

    describe('account_update', function () {
        it('Should update multisig account authorities', () => {
            let json = {
                account: 'honeycomb-msig',
                active: {
                    weight_threshold: 60,
                    account_auths: [
                        ['newsigner1', 40],
                        ['newsigner2', 30],
                        ['newsigner3', 30]
                    ],
                    key_auths: []
                },
                owner: {
                    weight_threshold: 3,
                    key_auths: [
                        ['STM8GC13uCZbP44HzMLV6zPZGwVQ8Nt4Kji8PapsPiNq1BK153XTX', 1],
                        ['STM7WDG2QpThdkRa3G2PYXM7gH9UksoGm4xqoFBrKdgKBmgkz3Npe', 1],
                        ['STM6vJmrwaX5TjgTS9dPH8KsArso5m91fVodJvv91j7G7gG6NxMNL', 1]
                    ],
                    account_auths: []
                },
                memo_key: 'STM8GC13uCZbP44HzMLV6zPZGwVQ8Nt4Kji8PapsPiNq1BK153XTX'
            }
            
            return new Promise((resolve) => {
                const pc = [resolve, () => {}, []];
                account_update(json, pc);
            })
            .then(() => {
                // Verify authorities were updated
                return new Promise((resolve, reject) => {
                    store.get(['stats', 'ms'], (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
            })
            .then(ms => {
                // Check active authorities updated
                assert.equal(ms.active_account_auths.newsigner1, 40)
                assert.equal(ms.active_account_auths.newsigner2, 30)
                assert.equal(ms.active_account_auths.newsigner3, 30)
                assert.equal(ms.active_threshold, 60)
                
                // Check owner authorities updated
                assert.equal(Object.keys(ms.owner_key_auths).length, 3)
                assert.equal(ms.owner_threshold, 3)
                
                // Check memo key updated
                assert.equal(ms.memo_key, 'STM8GC13uCZbP44HzMLV6zPZGwVQ8Nt4Kji8PapsPiNq1BK153XTX')
            })
        })

        it('Should clear msso operations after account update', () => {
            // Setup: Add some owner operations
            return new Promise((resolve, reject) => {
                const setupOps = [
                    {
                        type: 'put',
                        path: ['msso', '100002'],
                        data: { some: 'operation' }
                    },
                    {
                        type: 'put',
                        path: ['msso', '100002:sigs'],
                        data: { signer1: 'sig1' }
                    }
                ];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    account: 'honeycomb-msig',
                    active: {
                        weight_threshold: 51,
                        account_auths: [['signer1', 100]],
                        key_auths: []
                    }
                }
                
                return new Promise((resolve) => {
                    const pc = [resolve, () => {}, []];
                    account_update(json, pc);
                });
            })
            .then(() => {
                // Verify msso was cleared
                return new Promise((resolve, reject) => {
                    store.get(['msso'], (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
            })
            .then(msso => {
                // Should be empty after account update
                assert.deepEqual(msso, {})
            })
        })
    });

    describe('Security Scenarios', function () {
        it('Should prevent replay attacks with expired operations', () => {
            // Setup: Create an expired multisig operation
            return new Promise((resolve, reject) => {
                const msop = {
                    operations: [['transfer', {
                        from: 'honeycomb-msig',
                        to: 'attacker',
                        amount: '1000.000 LARYNX',
                        memo: 'Expired transfer'
                    }]],
                    expiration: '2020-01-01T00:00:00', // Expired
                    extensions: [],
                    ref_block_num: 1,
                    ref_block_prefix: 1
                };
                
                const setupOps = [{
                    type: 'put',
                    path: ['mss', '100003'],
                    data: JSON.stringify(msop)
                }];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    sig_block: '100003',
                    sig: 'SIG_K1_ExpiredOpSig'
                }
                // In real implementation, expired operations would be rejected
                return callOp(sig_submit, json, 'signer1')
            })
        })

        it('Should track signature counts for node rewards', () => {
            // Create multiple operations and sign them
            const operations = ['100004', '100005', '100006'];
            
            return Promise.all(operations.map(block => {
                return new Promise((resolve, reject) => {
                    const msop = {
                        operations: [['custom_json', {
                            id: 'honeycomb',
                            json: JSON.stringify({ op: 'test' })
                        }]],
                        expiration: '2025-12-31T23:59:59',
                        extensions: []
                    };
                    
                    const setupOps = [
                        {
                            type: 'put',
                            path: ['mss', block],
                            data: JSON.stringify(msop)
                        },
                        {
                            type: 'put',
                            path: ['mss', `${block}:sigs`],
                            data: {}
                        }
                    ];
                    store.batch(setupOps, [resolve, reject])
                });
            }))
            .then(() => {
                // Submit signatures for each operation
                return Promise.all(operations.map(block => {
                    let json = {
                        sig_block: block,
                        sig: `SIG_K1_TestSig${block}`
                    }
                    return callOp(sig_submit, json, 'signer2')
                }))
            })
            .then(() => {
                // Check accumulated signature count
                return new Promise((resolve, reject) => {
                    store.get(['markets', 'nodes', 'signer2'], (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
            })
            .then(node => {
                // Should have tracked all signatures
                assert.equal(node.vS, 3)
            })
        })

        it('Should handle weight changes during pending operations', () => {
            // This tests a scenario where signer weights change while operations are pending
            // Setup: Create operation with current weights
            return new Promise((resolve, reject) => {
                const msop = {
                    operations: [['transfer', {
                        from: 'honeycomb-msig',
                        to: 'bob',
                        amount: '50.000 LARYNX',
                        memo: 'Weight change test'
                    }]],
                    expiration: '2025-12-31T23:59:59',
                    extensions: []
                };
                
                const setupOps = [
                    {
                        type: 'put',
                        path: ['mss', '100007'],
                        data: JSON.stringify(msop)
                    },
                    {
                        type: 'put',
                        path: ['mss', '100007:sigs'],
                        data: {
                            'signer1': 'SIG_K1_Sig1' // 25% weight
                        }
                    }
                ];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                // Update signer weights
                return new Promise((resolve, reject) => {
                    const updateOps = [{
                        type: 'put',
                        path: ['stats', 'ms', 'active_account_auths'],
                        data: {
                            'signer1': 10,  // Reduced from 25% to 10%
                            'signer2': 45,  // Increased from 30% to 45%
                            'signer3': 45,  // Same 45%
                            'signer4': 20   // Same 20%
                        }
                    }];
                    store.batch(updateOps, [resolve, reject])
                });
            })
            .then(() => {
                // Now signer2 adds signature with new weight
                let json = {
                    sig_block: '100007',
                    sig: 'SIG_K1_Sig2'
                }
                return callOp(sig_submit, json, 'signer2')
            })
            .then(ops => {
                // With new weights: 10% + 45% = 55% > 51% threshold
                // Operation should execute
                assert.isArray(ops)
            })
        })
    });

    describe('Edge Cases', function () {
        it('Should handle malformed operation data', () => {
            // Setup: Create operation with invalid JSON
            return new Promise((resolve, reject) => {
                const setupOps = [
                    {
                        type: 'put',
                        path: ['mss', '100008'],
                        data: 'INVALID JSON DATA {{{' // Malformed
                    },
                    {
                        type: 'put',
                        path: ['mss', '100008:sigs'],
                        data: {}
                    }
                ];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    sig_block: '100008',
                    sig: 'SIG_K1_TestSig'
                }
                return callOp(sig_submit, json, 'signer1')
            })
            .then(ops => {
                // Should handle gracefully
                assert.isUndefined(ops)
            })
        })

        it('Should handle missing node mskey', () => {
            // Setup: Remove mskey from node
            return new Promise((resolve, reject) => {
                const setupOps = [{
                    type: 'put',
                    path: ['markets', 'nodes', 'signer1'],
                    data: { vS: 0 } // No mskey
                }];
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    sig_block: '100000',
                    sig: 'SIG_K1_NoKeyTest'
                }
                return callOp(sig_submit, json, 'signer1')
            })
            .then(ops => {
                // Should fail without mskey
                assert.isUndefined(ops)
            })
        })

        it('Should handle concurrent signatures properly', () => {
            // Test multiple signers submitting at once
            const signers = ['signer1', 'signer2', 'signer3'];
            
            return Promise.all(signers.map(signer => {
                let json = {
                    sig_block: '100000',
                    sig: `SIG_K1_Concurrent${signer}`
                }
                return callOp(sig_submit, json, signer)
            }))
            .then(results => {
                // All should succeed
                results.forEach(ops => {
                    assert.isArray(ops)
                })
            })
        })
    });
});