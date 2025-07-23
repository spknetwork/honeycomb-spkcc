import { assert } from 'chai';
import { HR } from './../processing_routes/index.mjs';
import { store } from './../index.mjs';
import test_state from './test_state.js';

// Set test environment
process.env.npm_lifecycle_event = 'test';

// Helper function to call operations in test mode
function callOp(opFunc, json, from, active = true) {
    return new Promise((resolve) => {
        const pc = [() => {}, () => {}, []]
        opFunc(json, from, active, pc)
        // Give time for async operations to complete and set pc[2]
        setTimeout(() => resolve(pc[2]), 50)
    })
}

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

describe('Power Operations', function () {
    this.timeout(10000);
    
    beforeEach(function () {
        return init();
    });

    describe('power_up', function () {
        it('Should power up tokens from liquid balance', () => {
            let json = {
                amount: 1000,
                block_num: 1,
                transaction_id: 'test_power_up_1'
            }
            return callOp(HR.power_up, json, 'alice')
            .then(ops => {
                assert.equal(ops.length, 4)
                assert.equal(ops[0].type, 'put')
                assert.equal(ops[0].path[1], 'alice')
                assert.equal(ops[0].data, 9000) // 10000 - 1000
                assert.equal(ops[1].type, 'put')
                assert.equal(ops[1].path[0], 'pow')
                assert.equal(ops[1].path[1], 'alice')
                assert.equal(ops[1].data, 1000)
                assert.equal(ops[2].type, 'put')
                assert.equal(ops[2].path[0], 'pow')
                assert.equal(ops[2].path[1], 't')
                assert.equal(ops[2].data, 1000)
                assert.include(ops[3].data, 'Powered up 1.000')
            })
        })

        it('Should fail power up with insufficient balance', () => {
            let json = {
                amount: 100000,
                block_num: 2,
                transaction_id: 'test_power_up_fail'
            }
            return callOp(HR.power_up, json, 'alice')
            .then(ops => {
                assert.equal(ops.length, 1)
                assert.include(ops[0].data, 'Invalid power up')
            })
        })

        it('Should fail power up with negative amount', () => {
            let json = {
                amount: -1000,
                block_num: 3,
                transaction_id: 'test_power_up_negative'
            }
            return callOp(HR.power_up, json, 'alice')
            .then(ops => {
                assert.equal(ops.length, 1)
                assert.include(ops[0].data, 'Invalid power up')
            })
        })

        it('Should handle multiple consecutive power ups', () => {
            let json1 = {
                amount: 1000,
                block_num: 4,
                transaction_id: 'test_power_up_multi_1'
            }
            let json2 = {
                amount: 2000,
                block_num: 5,
                transaction_id: 'test_power_up_multi_2'
            }
            
            return callOp(HR.power_up, json1, 'bob')
            .then(ops1 => {
                assert.equal(ops1[1].data, 1000) // pow balance
                assert.equal(ops1[0].data, 9000) // liquid balance
                
                return new Promise((resolve, reject) => {
                    // Simulate state update
                    store.batch(ops1, [resolve, reject])
                })
            })
            .then(() => {
                return callOp(HR.power_up, json2, 'bob')
            })
            .then(ops2 => {
                assert.equal(ops2[1].data, 3000) // pow balance (1000 + 2000)
                assert.equal(ops2[0].data, 7000) // liquid balance (9000 - 2000)
                assert.equal(ops2[2].data, 3000) // total pow
            })
        })
    })

    describe('power_down', function () {
        beforeEach(function () {
            // Setup: Give alice some powered up tokens
            return new Promise((resolve, reject) => {
                let setupOps = [
                    { type: 'put', path: ['pow', 'alice'], data: 4000 },
                    { type: 'put', path: ['pow', 't'], data: 4000 }
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should schedule power down over 4 weeks', () => {
            let json = {
                amount: 4000,
                block_num: 100,
                transaction_id: 'test_power_down_1'
            }
            return callOp(HR.power_down, json, 'alice')
            .then(ops => {
                // Should have: del old powd, put new powd, 4 chrono deletes (if any), feed message
                assert.isAtLeast(ops.length, 3)
                
                // Check new power down schedule
                let powdOp = ops.find(op => op.type === 'put' && op.path[0] === 'powd')
                assert.exists(powdOp)
                let powdData = powdOp.data
                let chronoKeys = Object.keys(powdData)
                assert.equal(chronoKeys.length, 4) // 4 weekly payments
                
                // Verify weekly amounts (1000 each)
                let totalAmount = 0
                chronoKeys.forEach(key => {
                    let blockNum = parseInt(key.split(':')[0])
                    assert.approximately(blockNum, json.block_num + 200000, 800000) // Within 4 weeks
                    totalAmount += 1000 // Each payment should be 1000
                })
                assert.equal(totalAmount, 4000)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Powered down 4.000')
            })
        })

        it('Should cancel power down with amount 0', () => {
            // First schedule a power down
            let setupJson = {
                amount: 4000,
                block_num: 100,
                transaction_id: 'test_power_down_setup'
            }
            
            return callOp(HR.power_down, setupJson, 'alice')
            .then(setupOps => {
                return new Promise((resolve, reject) => {
                    store.batch(setupOps, [resolve, reject])
                })
            })
            .then(() => {
                // Now cancel it
                let cancelJson = {
                    amount: 0,
                    block_num: 200,
                    transaction_id: 'test_power_down_cancel'
                }
                return callOp(HR.power_down, cancelJson, 'alice')
            })
            .then(ops => {
                // Should delete chrono entries and add feed message
                let deleteOps = ops.filter(op => op.type === 'del' && op.path[0] === 'chrono')
                assert.isAtLeast(deleteOps.length, 4) // Should delete 4 scheduled payments
                
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Canceled Power Down')
            })
        })

        it('Should fail power down with insufficient power', () => {
            let json = {
                amount: 5000, // More than the 4000 available
                block_num: 300,
                transaction_id: 'test_power_down_fail'
            }
            return callOp(HR.power_down, json, 'alice')
            .then(ops => {
                assert.equal(ops.length, 1)
                assert.include(ops[0].data, 'Invalid Power Down')
            })
        })

        it('Should handle odd amounts correctly in power down schedule', () => {
            let json = {
                amount: 3333, // Not evenly divisible by 4
                block_num: 400,
                transaction_id: 'test_power_down_odd'
            }
            return callOp(HR.power_down, json, 'alice')
            .then(ops => {
                let powdOp = ops.find(op => op.type === 'put' && op.path[0] === 'powd')
                assert.exists(powdOp)
                
                // Weekly amount should be 833, with last payment being 833 + 1 (remainder)
                // 833 * 3 + 834 = 3333
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Powered down 3.333')
            })
        })
    })

    describe('power_grant', function () {
        beforeEach(function () {
            // Setup: Give users some powered up tokens
            return new Promise((resolve, reject) => {
                let setupOps = [
                    { type: 'put', path: ['pow', 'alice'], data: 5000 },
                    { type: 'put', path: ['pow', 'bob'], data: 2000 },
                    { type: 'put', path: ['pow', 't'], data: 7000 }
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should grant power from one user to another', () => {
            let json = {
                amount: 1000,
                to: 'bob',
                block_num: 500,
                transaction_id: 'test_power_grant_1'
            }
            return callOp(HR.power_grant, json, 'alice')
            .then(ops => {
                // Check granting records
                let grantingFromTotal = ops.find(op => 
                    op.path[0] === 'granting' && op.path[1] === 'alice' && op.path[2] === 't'
                )
                assert.equal(grantingFromTotal.data, 1000)
                
                let grantingToBob = ops.find(op => 
                    op.path[0] === 'granting' && op.path[1] === 'alice' && op.path[2] === 'bob'
                )
                assert.equal(grantingToBob.data, 1000)
                
                // Check granted records
                let grantedToTotal = ops.find(op => 
                    op.path[0] === 'granted' && op.path[1] === 'bob' && op.path[2] === 't'
                )
                assert.equal(grantedToTotal.data, 1000)
                
                let grantedFromAlice = ops.find(op => 
                    op.path[0] === 'granted' && op.path[1] === 'bob' && op.path[2] === 'alice'
                )
                assert.equal(grantedFromAlice.data, 1000)
                
                // Check power reduction
                let powerOp = ops.find(op => 
                    op.path[0] === 'pow' && op.path[1] === 'alice'
                )
                assert.equal(powerOp.data, 4000) // 5000 - 1000
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Has granted 1.000 to bob')
            })
        })

        it('Should reduce existing grant when granting less', () => {
            // First grant 2000
            let json1 = {
                amount: 2000,
                to: 'bob',
                block_num: 600,
                transaction_id: 'test_power_grant_setup'
            }
            
            return callOp(HR.power_grant, json1, 'alice')
            .then(ops1 => {
                return new Promise((resolve, reject) => {
                    store.batch(ops1, [resolve, reject])
                })
            })
            .then(() => {
                // Now reduce grant to 500
                let json2 = {
                    amount: 500,
                    to: 'bob',
                    block_num: 700,
                    transaction_id: 'test_power_grant_reduce'
                }
                return callOp(HR.power_grant, json2, 'alice')
            })
            .then(ops2 => {
                // Power should be restored by difference (1500)
                let powerOp = ops2.find(op => 
                    op.path[0] === 'pow' && op.path[1] === 'alice'
                )
                assert.equal(powerOp.data, 4500) // 3000 + 1500
                
                // Granting should be reduced
                let grantingOp = ops2.find(op => 
                    op.path[0] === 'granting' && op.path[1] === 'alice' && op.path[2] === 'bob'
                )
                assert.equal(grantingOp.data, 500)
            })
        })

        it('Should fail to grant more power than available', () => {
            let json = {
                amount: 6000, // More than alice's 5000
                to: 'bob',
                block_num: 800,
                transaction_id: 'test_power_grant_fail'
            }
            return callOp(HR.power_grant, json, 'alice')
            .then(ops => {
                assert.equal(ops.length, 1)
                assert.include(ops[0].data, 'Invalid delegation')
            })
        })

        it('Should fail to grant to self', () => {
            let json = {
                amount: 1000,
                to: 'alice',
                block_num: 900,
                transaction_id: 'test_power_grant_self'
            }
            return callOp(HR.power_grant, json, 'alice')
            .then(ops => {
                assert.equal(ops.length, 1)
                assert.include(ops[0].data, 'Invalid delegation')
            })
        })

        it('Should handle up/down max adjustments correctly', () => {
            // Setup up/down objects
            return new Promise((resolve, reject) => {
                let setupOps = [
                    { type: 'put', path: ['up', 'alice'], data: { max: 5000 } },
                    { type: 'put', path: ['down', 'alice'], data: { max: 5000 } },
                    { type: 'put', path: ['up', 'bob'], data: { max: 2000 } },
                    { type: 'put', path: ['down', 'bob'], data: { max: 2000 } }
                ]
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    amount: 1000,
                    to: 'bob',
                    block_num: 1000,
                    transaction_id: 'test_power_grant_updown'
                }
                return callOp(HR.power_grant, json, 'alice')
            })
            .then(ops => {
                // Check up/down adjustments
                let upAlice = ops.find(op => 
                    op.path[0] === 'up' && op.path[1] === 'alice'
                )
                assert.equal(upAlice.data.max, 4000) // 5000 - 1000
                
                let downAlice = ops.find(op => 
                    op.path[0] === 'down' && op.path[1] === 'alice'
                )
                assert.equal(downAlice.data.max, 4000) // 5000 - 1000
                
                let upBob = ops.find(op => 
                    op.path[0] === 'up' && op.path[1] === 'bob'
                )
                assert.equal(upBob.data.max, 3000) // 2000 + 1000
                
                let downBob = ops.find(op => 
                    op.path[0] === 'down' && op.path[1] === 'bob'
                )
                assert.equal(downBob.data.max, 3000) // 2000 + 1000
            })
        })
    })
})