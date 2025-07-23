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

describe('Vote Operations', function () {
    this.timeout(10000);
    
    beforeEach(function () {
        return init();
    });

    describe('vote', function () {
        beforeEach(function () {
            // Setup: Create a post and give voters some power
            return new Promise((resolve, reject) => {
                let setupOps = [
                    { type: 'put', path: ['posts', 'author/test-post'], data: { 
                        author: 'author',
                        permlink: 'test-post',
                        created: 1000,
                        votes: {}
                    }},
                    { type: 'put', path: ['pow', 'alice'], data: 1000 },
                    { type: 'put', path: ['pow', 'bob'], data: 2000 },
                    { type: 'put', path: ['pow', 'charlie'], data: 500 },
                    { type: 'put', path: ['granted', 'alice', 't'], data: 500 }, // Alice has granted power too
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should allow voting with positive weight', () => {
            let json = {
                author: 'author',
                permlink: 'test-post',
                weight: 10000, // 100% vote
                voter: 'alice',
                block_num: 1000,
                transaction_id: 'test_vote_1'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(ops => {
                // Check vote power update
                let upOp = ops.find(op => op.path[0] === 'up' && op.path[1] === 'alice')
                assert.exists(upOp)
                assert.equal(upOp.data.max, 75000) // (1000 + 500) * 50
                assert.equal(upOp.data.last, 1000)
                assert.isBelow(upOp.data.power, 75000) // Should be reduced by vote amount
                
                // Check post update with vote
                let postOp = ops.find(op => op.path[0] === 'posts')
                assert.exists(postOp)
                assert.exists(postOp.data.votes.alice)
                assert.equal(postOp.data.votes.alice.b, 1000)
                assert.isAbove(postOp.data.votes.alice.v, 0)
            })
        })

        it('Should allow voting with 50% weight', () => {
            let json = {
                author: 'author',
                permlink: 'test-post',
                weight: 5000, // 50% vote
                voter: 'bob',
                block_num: 2000,
                transaction_id: 'test_vote_2'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(ops => {
                let upOp = ops.find(op => op.path[0] === 'up' && op.path[1] === 'bob')
                assert.exists(upOp)
                assert.equal(upOp.data.max, 100000) // 2000 * 50
                
                // Vote value should be proportional to weight
                let postOp = ops.find(op => op.path[0] === 'posts')
                assert.exists(postOp.data.votes.bob)
                // 50% vote should use less power than 100%
                let votePower = upOp.data.max - upOp.data.power
                assert.isAbove(votePower, 0)
                assert.isBelow(votePower, upOp.data.max * 0.1) // Less than 10% of max power used
            })
        })

        it('Should handle downvotes (negative weight)', () => {
            let json = {
                author: 'author',
                permlink: 'test-post',
                weight: -5000, // 50% downvote
                voter: 'bob',
                block_num: 3000,
                transaction_id: 'test_downvote_1'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(ops => {
                // Should update both up and down power
                let upOp = ops.find(op => op.path[0] === 'up' && op.path[1] === 'bob')
                let downOp = ops.find(op => op.path[0] === 'down' && op.path[1] === 'bob')
                assert.exists(upOp)
                assert.exists(downOp)
                
                // Down power should be initialized and used
                assert.equal(downOp.data.max, 100000) // 2000 * 50
                assert.equal(downOp.data.last, 3000)
                assert.isBelow(downOp.data.power, downOp.data.max)
                
                // Post should have negative vote value
                let postOp = ops.find(op => op.path[0] === 'posts')
                assert.exists(postOp.data.votes.bob)
                assert.isAbove(postOp.data.votes.bob.v, 0) // Vote value is absolute, weight determines direction
            })
        })

        it('Should regenerate voting power over time', () => {
            // First vote at block 1000
            let json1 = {
                author: 'author',
                permlink: 'test-post',
                weight: 10000,
                voter: 'alice',
                block_num: 1000,
                transaction_id: 'test_regen_1'
            }
            
            return new Promise((resolve, reject) => {
                vote(json1, [resolve, reject, json1])
            })
            .then(ops1 => {
                let firstVoteUp = ops1.find(op => op.path[0] === 'up' && op.path[1] === 'alice')
                let firstPower = firstVoteUp.data.power
                
                return new Promise((resolve, reject) => {
                    store.batch(ops1, [resolve, reject])
                })
                .then(() => {
                    // Second vote 28800 blocks later (20% regeneration)
                    let json2 = {
                        author: 'author',
                        permlink: 'test-post',
                        weight: 5000,
                        voter: 'alice',
                        block_num: 29800, // 28800 blocks = 1 day = 20% regeneration
                        transaction_id: 'test_regen_2'
                    }
                    
                    return new Promise((resolve, reject) => {
                        vote(json2, [resolve, reject, json2])
                    })
                })
                .then(ops2 => {
                    let secondVoteUp = ops2.find(op => op.path[0] === 'up' && op.path[1] === 'alice')
                    // Power should have regenerated
                    assert.isAbove(secondVoteUp.data.power, firstPower)
                })
            })
        })

        it('Should not allow voting without power', () => {
            let json = {
                author: 'author',
                permlink: 'test-post',
                weight: 10000,
                voter: 'nopoweruser',
                block_num: 4000,
                transaction_id: 'test_nopower'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(result => {
                // Should complete without ops (pc[0](pc[2]) called)
                assert.isUndefined(result)
            })
        })

        it('Should not allow voting on non-existent posts', () => {
            let json = {
                author: 'fake',
                permlink: 'fake-post',
                weight: 10000,
                voter: 'alice',
                block_num: 5000,
                transaction_id: 'test_fakepost'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(result => {
                // Should complete without ops
                assert.isUndefined(result)
            })
        })

        it('Should handle multiple voters on same post', () => {
            let json1 = {
                author: 'author',
                permlink: 'test-post',
                weight: 10000,
                voter: 'alice',
                block_num: 6000,
                transaction_id: 'test_multi_1'
            }
            
            let json2 = {
                author: 'author',
                permlink: 'test-post',
                weight: 7500,
                voter: 'bob',
                block_num: 6100,
                transaction_id: 'test_multi_2'
            }
            
            let json3 = {
                author: 'author',
                permlink: 'test-post',
                weight: -5000, // Charlie downvotes
                voter: 'charlie',
                block_num: 6200,
                transaction_id: 'test_multi_3'
            }
            
            return Promise.all([
                new Promise((resolve, reject) => vote(json1, [resolve, reject, json1])),
                new Promise((resolve, reject) => vote(json2, [resolve, reject, json2])),
                new Promise((resolve, reject) => vote(json3, [resolve, reject, json3]))
            ])
            .then(results => {
                // Collect all post updates
                let postUpdates = []
                results.forEach(ops => {
                    if (ops) {
                        let postOp = ops.find(op => op.path[0] === 'posts')
                        if (postOp) postUpdates.push(postOp.data)
                    }
                })
                
                // Last update should have all votes
                let finalPost = postUpdates[postUpdates.length - 1]
                assert.exists(finalPost.votes.alice)
                assert.exists(finalPost.votes.bob)
                assert.exists(finalPost.votes.charlie)
                
                // All votes should have block numbers and values
                assert.isAbove(finalPost.votes.alice.v, 0)
                assert.isAbove(finalPost.votes.bob.v, 0)
                assert.isAbove(finalPost.votes.charlie.v, 0)
            })
        })

        it('Should include granted power in vote calculation', () => {
            // Alice has 1000 own power + 500 granted = 1500 total
            let json = {
                author: 'author',
                permlink: 'test-post',
                weight: 10000,
                voter: 'alice',
                block_num: 7000,
                transaction_id: 'test_granted'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(ops => {
                let upOp = ops.find(op => op.path[0] === 'up' && op.path[1] === 'alice')
                // Max power should include granted power
                assert.equal(upOp.data.max, 75000) // (1000 + 500) * 50
                
                let postOp = ops.find(op => op.path[0] === 'posts')
                // Vote value should reflect total power
                assert.isAbove(postOp.data.votes.alice.v, 0)
            })
        })

        it('Should handle edge case of zero weight vote', () => {
            let json = {
                author: 'author',
                permlink: 'test-post',
                weight: 0,
                voter: 'bob',
                block_num: 8000,
                transaction_id: 'test_zero_weight'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(ops => {
                // Should still process but with minimal effect
                let postOp = ops.find(op => op.path[0] === 'posts')
                assert.exists(postOp.data.votes.bob)
                assert.equal(postOp.data.votes.bob.v, 0) // Zero weight = zero vote value
            })
        })

        it('Should cap vote power regeneration at maximum', () => {
            // Vote after very long time (full regeneration)
            let json = {
                author: 'author',
                permlink: 'test-post',
                weight: 1000, // Small vote to check power level
                voter: 'bob',
                block_num: 1000000, // Very far in future
                transaction_id: 'test_full_regen'
            }
            
            return new Promise((resolve, reject) => {
                const pc = [() => resolve(pc[2]), () => {}, []]
                HR.vote(json, pc)
            })
            .then(ops => {
                let upOp = ops.find(op => op.path[0] === 'up' && op.path[1] === 'bob')
                // Power should be at or very close to max (minus the small vote)
                assert.isAbove(upOp.data.power, upOp.data.max * 0.95)
            })
        })
    })
})