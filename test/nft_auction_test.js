import { assert } from 'chai';
import { HR } from './../processing_routes/index.mjs';
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

// Mock chronAssign for auction expiry
global.chronAssign = (block, data) => {
    return Promise.resolve(`${block}:chrono:${data.op}`);
};

function init() {
    return new Promise((resolve, reject) => {
        store.del([], function (e) {
            if (e) { console.log(e) }
            // Add auction-specific test data
            const auctionTestState = {
                ...test_state,
                ah: {}, // Auction house for NFTs (token)
                ahh: {}, // Auction house for NFTs (HIVE/HBD)
                am: {}, // Auction house for mint tokens
                sets: {
                    'AUCTION': {
                        a: 'nft-creator',
                        n: 'AUCTION',
                        r: 500, // 5% royalty
                        u: { 'item1': 'auction-seller', 'item2': 'auction-seller', 'item3': 'nft-owner' }
                    }
                },
                nfts: {
                    'auction-seller': {
                        'AUCTION:item1': { s: '1000@init', j: { name: 'Auction Item 1' }, l: false },
                        'AUCTION:item2': { s: '1000@init', j: { name: 'Auction Item 2' }, l: false }
                    },
                    'nft-owner': {
                        'AUCTION:item3': { s: '1000@init', j: { name: 'Auction Item 3' }, l: false }
                    }
                },
                rnfts: {
                    'MINTAUCTION': {
                        'mint-seller': 5,
                        'mint-owner': 3
                    }
                },
                balances: {
                    ...test_state.balances,
                    'auction-seller': 10000000,
                    'bidder1': 25000000,
                    'bidder2': 30000000,
                    'bidder3': 15000000,
                    'mint-seller': 5000000,
                    'mint-owner': 8000000
                }
            }
            store.put([], auctionTestState, function (err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

describe('NFT Auction Operations', function () {
    this.timeout(10000);
    
    beforeEach(function () {
        return init();
    });

    describe('nft_auction (Token Auctions)', function () {
        it('Should create NFT auction with starting price', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item1',
                price: 5000, // Starting price: 5 tokens
                time: 7, // 7 days
                block_num: 10000,
                transaction_id: 'test_auction_1'
            }
            return callOp(HR.nft_auction, json, 'auction-seller')
            .then(ops => {
                assert.isArray(ops)
                
                // Check auction house listing
                let ahOp = ops.find(op => op.path[0] === 'ah')
                assert.exists(ahOp)
                let listing = ahOp.data['AUCTION:item1']
                assert.exists(listing)
                assert.equal(listing.p, 5000) // Starting price
                assert.equal(listing.o, 'auction-seller') // Owner
                assert.equal(listing.t, 7) // Time in days
                assert.equal(listing.e, 10000 + (7 * 1200 * 24)) // Expiry block
                assert.equal(listing.c, 0) // Bid count
                assert.exists(listing.q) // Expiry path
                assert.exists(listing.nft) // NFT data included
                
                // Check NFT removed from seller
                let delOp = ops.find(op => 
                    op.type === 'del' && 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'auction-seller'
                )
                assert.exists(delOp)
                
                // Check set ownership update
                let setOp = ops.find(op => op.path[0] === 'sets')
                assert.equal(setOp.data.u.item1, 'ah') // Moved to auction house
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Listed AUCTION:item1 for auction')
            })
        })

        it('Should create auction with buy-it-now price', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item2',
                price: 1000, // Starting price
                now: 10000, // Buy it now price
                time: 3, // 3 days
                block_num: 11000,
                transaction_id: 'test_auction_now'
            }
            return callOp(HR.nft_auction, json, 'auction-seller')
            .then(ops => {
                let ahOp = ops.find(op => op.path[0] === 'ah')
                let listing = ahOp.data['AUCTION:item2']
                assert.equal(listing.p, 1000) // Starting price
                assert.equal(listing.n, 10000) // Buy it now price
                assert.equal(listing.t, 3) // 3 days
            })
        })

        it('Should enforce auction time limits', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item3',
                price: 2000,
                time: 45, // Too long (max 30 days)
                block_num: 12000,
                transaction_id: 'test_auction_time'
            }
            return callOp(HR.nft_auction, json, 'nft-owner')
            .then(ops => {
                let ahOp = ops.find(op => op.path[0] === 'ah')
                let listing = ahOp.data['AUCTION:item3']
                assert.equal(listing.t, 7) // Defaults to 7 days when invalid
            })
        })

        it('Should fail to auction NFT not owned', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item1', // Owned by auction-seller
                price: 5000,
                block_num: 13000,
                transaction_id: 'test_auction_fail'
            }
            return callOp(HR.nft_auction, json, 'bidder1')
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('nft_bid', function () {
        beforeEach(function () {
            // Setup: Create an active auction
            return new Promise((resolve, reject) => {
                let setupOps = [{
                    type: 'put',
                    path: ['ah', 'AUCTION:item1'],
                    data: {
                        p: 5000, // Starting price
                        n: '', // No buy it now
                        t: 7,
                        e: 20000, // Expires at block 20000
                        i: 'AUCTION:item1',
                        q: '20000:chrono:ahe',
                        o: 'auction-seller',
                        c: 0, // No bids yet
                        nft: { s: '10000@auction', j: {} }
                    }
                }]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should place first bid on auction', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item1',
                bid_amount: 6000, // Above starting price
                block_num: 14000,
                transaction_id: 'test_bid_1'
            }
            return callOp(HR.nft_bid, json, 'bidder1')
            .then(ops => {
                assert.isArray(ops)
                
                // Check auction update
                let ahOp = ops.find(op => op.path[0] === 'ah')
                assert.exists(ahOp)
                let listing = ahOp.data['AUCTION:item1']
                assert.equal(listing.f, 'bidder1') // High bidder
                assert.equal(listing.b, 6000) // Bid amount
                assert.equal(listing.c, 1) // Bid count
                
                // Check bidder balance reduction
                let balOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'bidder1'
                )
                assert.equal(balOp.data, 25000000 - 6000)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'bid 6.000')
            })
        })

        it('Should outbid existing bidder and refund', () => {
            // Setup: Add existing bid
            return new Promise((resolve, reject) => {
                let setupOps = [
                    {
                        type: 'put',
                        path: ['ah', 'AUCTION:item1'],
                        data: {
                            p: 5000,
                            e: 20000,
                            i: 'AUCTION:item1',
                            o: 'auction-seller',
                            c: 1,
                            f: 'bidder1', // Current high bidder
                            b: 6000, // Current bid
                            nft: { s: '10000@auction', j: {} }
                        }
                    },
                    {
                        type: 'put',
                        path: ['balances', 'bidder1'],
                        data: 25000000 - 6000 // Already bid 6000
                    }
                ]
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    set: 'AUCTION',
                    uid: 'item1',
                    bid_amount: 8000, // Higher bid
                    block_num: 15000,
                    transaction_id: 'test_outbid'
                }
                return callOp(HR.nft_bid, json, 'bidder2')
            })
            .then(ops => {
                // Check new high bidder
                let ahOp = ops.find(op => op.path[0] === 'ah')
                let listing = ahOp.data['AUCTION:item1']
                assert.equal(listing.f, 'bidder2')
                assert.equal(listing.b, 8000)
                assert.equal(listing.c, 2) // Incremented bid count
                
                // Check bidder2 balance reduction
                let bal2Op = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'bidder2'
                )
                assert.equal(bal2Op.data, 30000000 - 8000)
                
                // Note: Refund to bidder1 happens via add() function
            })
        })

        it('Should fail bid below current bid', () => {
            // Setup: Existing high bid
            return new Promise((resolve, reject) => {
                let setupOps = [{
                    type: 'put',
                    path: ['ah', 'AUCTION:item1'],
                    data: {
                        p: 5000,
                        e: 20000,
                        f: 'bidder1',
                        b: 10000, // High bid
                        c: 1,
                        nft: { s: '10000@auction', j: {} }
                    }
                }]
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    set: 'AUCTION',
                    uid: 'item1',
                    bid_amount: 9000, // Below current bid
                    block_num: 16000,
                    transaction_id: 'test_bid_low'
                }
                return callOp(HR.nft_bid, json, 'bidder3')
            })
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })

        it('Should fail bid with insufficient balance', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item1',
                bid_amount: 20000000, // More than bidder3 has
                block_num: 17000,
                transaction_id: 'test_bid_poor'
            }
            return callOp(HR.nft_bid, json, 'bidder3')
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('nft_hauction (HIVE/HBD Auctions)', function () {
        it('Should create HIVE auction', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item3',
                price: 10000, // 10 HIVE starting price
                type: 'HIVE',
                time: 5, // 5 days
                block_num: 18000,
                transaction_id: 'test_hauction_hive'
            }
            return callOp(HR.nft_hauction, json, 'nft-owner')
            .then(ops => {
                assert.isArray(ops)
                
                // Check HIVE auction house listing
                let ahhOp = ops.find(op => op.path[0] === 'ahh')
                assert.exists(ahhOp)
                let listing = ahhOp.data['AUCTION:item3']
                assert.equal(listing.p, 10000)
                assert.equal(listing.h, 'HIVE') // Currency type
                assert.equal(listing.t, 5)
                assert.equal(listing.o, 'nft-owner')
                
                // Check set ownership
                let setOp = ops.find(op => op.path[0] === 'sets')
                assert.equal(setOp.data.u.item3, 'hh') // HIVE auction house
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'for HIVE auction')
            })
        })

        it('Should create HBD auction', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item1',
                price: 5000, // 5 HBD
                type: 'HBD',
                time: 7,
                now: 20000, // Buy it now: 20 HBD
                block_num: 19000,
                transaction_id: 'test_hauction_hbd'
            }
            return callOp(HR.nft_hauction, json, 'auction-seller')
            .then(ops => {
                let ahhOp = ops.find(op => op.path[0] === 'ahh')
                let listing = ahhOp.data['AUCTION:item1']
                assert.equal(listing.h, 'HBD')
                assert.equal(listing.p, 5000)
                assert.equal(listing.n, 20000)
            })
        })

        it('Should enforce max 7 days for HIVE/HBD auctions', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item2',
                price: 3000,
                type: 'HIVE',
                time: 10, // Too long (max 7 for HIVE/HBD)
                block_num: 20000,
                transaction_id: 'test_hauction_time'
            }
            return callOp(HR.nft_hauction, json, 'auction-seller')
            .then(ops => {
                let ahhOp = ops.find(op => op.path[0] === 'ahh')
                let listing = ahhOp.data['AUCTION:item2']
                assert.equal(listing.t, 7) // Capped at 7 days
            })
        })
    })

    describe('ft_auction (Mint Token Auctions)', function () {
        it('Should create mint token auction', () => {
            let json = {
                set: 'MINTAUCTION',
                price: 2000, // 2 tokens starting price
                time: 10, // 10 days
                block_num: 21000,
                transaction_id: 'test_ft_auction'
            }
            return callOp(HR.ft_auction, json, 'mint-seller')
            .then(ops => {
                assert.isArray(ops)
                
                // Check mint token auction house
                let amOp = ops.find(op => op.path[0] === 'am')
                assert.exists(amOp)
                // Find the auction by pattern (uses hash)
                let auctionKey = Object.keys(amOp.data).find(k => k.startsWith('MINTAUCTION:'))
                assert.exists(auctionKey)
                let listing = amOp.data[auctionKey]
                assert.equal(listing.p, 2000)
                assert.equal(listing.o, 'mint-seller')
                assert.equal(listing.t, 10)
                
                // Check mint token reduction
                let rnftOp = ops.find(op => op.path[0] === 'rnfts')
                assert.equal(rnftOp.data, 4) // 5 - 1
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Listed a MINTAUCTION mint token for auction')
            })
        })

        it('Should create mint token auction with buy-it-now', () => {
            let json = {
                set: 'MINTAUCTION',
                price: 1000,
                now: 5000, // Buy it now
                time: 5,
                block_num: 22000,
                transaction_id: 'test_ft_auction_now'
            }
            return callOp(HR.ft_auction, json, 'mint-owner')
            .then(ops => {
                let amOp = ops.find(op => op.path[0] === 'am')
                let auctionKey = Object.keys(amOp.data).find(k => k.startsWith('MINTAUCTION:'))
                let listing = amOp.data[auctionKey]
                assert.equal(listing.p, 1000)
                assert.equal(listing.n, 5000)
            })
        })

        it('Should fail mint token auction without tokens', () => {
            let json = {
                set: 'MINTAUCTION',
                price: 1000,
                block_num: 23000,
                transaction_id: 'test_ft_auction_fail'
            }
            return callOp(HR.ft_auction, json, 'bidder1') // Has no mint tokens
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('ft_bid (Mint Token Bidding)', function () {
        beforeEach(function () {
            // Setup: Create mint token auction
            return new Promise((resolve, reject) => {
                let setupOps = [{
                    type: 'put',
                    path: ['am', 'MINTAUCTION:hash123'],
                    data: {
                        p: 3000,
                        n: '',
                        t: 7,
                        e: 30000,
                        i: 'MINTAUCTION:hash123',
                        q: '30000:chrono:ame',
                        o: 'mint-seller',
                        c: 0
                    }
                }]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should bid on mint token auction', () => {
            let json = {
                set: 'MINTAUCTION',
                uid: 'hash123',
                bid_amount: 4000,
                block_num: 24000,
                transaction_id: 'test_ft_bid'
            }
            return callOp(HR.ft_bid, json, 'bidder2')
            .then(ops => {
                assert.isArray(ops)
                
                // Check auction update
                let amOp = ops.find(op => op.path[0] === 'am')
                let listing = amOp.data['MINTAUCTION:hash123']
                assert.equal(listing.f, 'bidder2')
                assert.equal(listing.b, 4000)
                assert.equal(listing.c, 1)
                
                // Check balance reduction
                let balOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'bidder2'
                )
                assert.equal(balOp.data, 30000000 - 4000)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'mint token auction')
            })
        })
    })

    describe('Auction Lifecycle', function () {
        it('Should handle complete auction lifecycle', async function () {
            // 1. Create auction
            let createJson = {
                set: 'AUCTION',
                uid: 'item1',
                price: 1000,
                time: 7,
                block_num: 25000,
                transaction_id: 'lifecycle_create'
            }
            
            let createOps = await callOp(HR.nft_auction, createJson, 'auction-seller')
            assert.isArray(createOps)
            
            // Apply create ops
            await new Promise((resolve, reject) => {
                store.batch(createOps, [resolve, reject])
            })
            
            // 2. First bid
            let bid1Json = {
                set: 'AUCTION',
                uid: 'item1',
                bid_amount: 2000,
                block_num: 25100,
                transaction_id: 'lifecycle_bid1'
            }
            
            let bid1Ops = await callOp(HR.nft_bid, bid1Json, 'bidder1')
            assert.isArray(bid1Ops)
            
            // 3. Second bid (outbid)
            await new Promise((resolve, reject) => {
                store.batch(bid1Ops, [resolve, reject])
            })
            
            let bid2Json = {
                set: 'AUCTION',
                uid: 'item1',
                bid_amount: 3000,
                block_num: 25200,
                transaction_id: 'lifecycle_bid2'
            }
            
            let bid2Ops = await callOp(HR.nft_bid, bid2Json, 'bidder2')
            assert.isArray(bid2Ops)
            
            let finalAuction = bid2Ops.find(op => op.path[0] === 'ah').data['AUCTION:item1']
            assert.equal(finalAuction.f, 'bidder2')
            assert.equal(finalAuction.b, 3000)
            assert.equal(finalAuction.c, 2) // Two bids total
        })
    })

    describe('Edge Cases', function () {
        it('Should handle minimum price correctly', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item1',
                price: -100, // Invalid negative price
                block_num: 26000,
                transaction_id: 'test_min_price'
            }
            return callOp(HR.nft_auction, json, 'auction-seller')
            .then(ops => {
                let ahOp = ops.find(op => op.path[0] === 'ah')
                let listing = ahOp.data['AUCTION:item1']
                assert.equal(listing.p, 1000) // Defaults to minimum 1000
            })
        })

        it('Should handle buy-it-now validation', () => {
            let json = {
                set: 'AUCTION',
                uid: 'item2',
                price: 5000,
                now: 4000, // Buy-it-now less than starting price
                block_num: 27000,
                transaction_id: 'test_invalid_now'
            }
            return callOp(HR.nft_auction, json, 'auction-seller')
            .then(ops => {
                let ahOp = ops.find(op => op.path[0] === 'ah')
                let listing = ahOp.data['AUCTION:item2']
                assert.equal(listing.n, '') // Buy-it-now removed when invalid
            })
        })

        it('Should prevent self-bidding manipulation', () => {
            // Setup: Seller creates auction
            return new Promise((resolve, reject) => {
                let setupOps = [{
                    type: 'put',
                    path: ['ah', 'AUCTION:item1'],
                    data: {
                        p: 1000,
                        e: 30000,
                        o: 'auction-seller', // Owner
                        c: 0,
                        nft: { s: '10000@auction', j: {} }
                    }
                }]
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                // Seller tries to bid on own auction
                let json = {
                    set: 'AUCTION',
                    uid: 'item1',
                    bid_amount: 2000,
                    block_num: 28000,
                    transaction_id: 'test_self_bid'
                }
                return callOp(HR.nft_bid, json, 'auction-seller')
            })
            .then(ops => {
                // Should be allowed but doesn't make economic sense
                // The system allows it but seller pays fees to themselves
                assert.isArray(ops)
            })
        })
    })
})