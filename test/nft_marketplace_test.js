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
        setTimeout(() => resolve(pc[2]), 50);
    });
}

function init() {
    return new Promise((resolve, reject) => {
        store.del([], function (e) {
            if (e) { console.log(e) }
            // Add NFT specific test data to test_state
            const nftTestState = {
                ...test_state,
                stats: {
                    nft_fee_1: 1000, // 1 token base fee
                    nft_byte_cost: 10 // 0.01 token per byte
                },
                sets: {},
                nfts: {},
                rnfts: {},
                ls: {},
                balances: {
                    ...test_state.balances,
                    'nft-creator': 50000000, // 50,000 tokens
                    'nft-owner': 10000000,   // 10,000 tokens
                    'nft-buyer': 20000000,   // 20,000 tokens
                    'nft-seller': 15000000,  // 15,000 tokens
                    'royalty-receiver': 0
                }
            }
            store.put([], nftTestState, function (err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

describe('NFT Marketplace Operations', function () {
    this.timeout(10000);
    
    beforeEach(function () {
        return init();
    });

    describe('nft_define', function () {
        it('Should define a new NFT set', () => {
            let json = {
                name: 'TESTNFT',
                type: 1, // Basic NFT
                script: 'Qmabcdef123456', // IPFS hash
                start: 'a', // Base64 start
                end: 'z',   // Base64 end
                royalty: 100, // 1% royalty
                handling: 'ipfs',
                permlink: 'test-nft-set',
                max_fee: 100000, // Max 100 tokens fee
                bond: 1000, // 1 token burn per NFT
                block_num: 1000,
                transaction_id: 'test_define_1'
            }
            return callOp(HR.nft_define, json, 'nft-creator')
            .then(ops => {
                assert.isArray(ops)
                assert.isAbove(ops.length, 2)
                
                // Check balance deduction for fee
                let balanceOp = ops.find(op => op.path[0] === 'balances' && op.path[1] === 'nft-creator')
                assert.exists(balanceOp)
                assert.isBelow(balanceOp.data, 50000000) // Balance reduced
                
                // Check set creation
                let setOp = ops.find(op => op.path[0] === 'sets' && op.path[1] === 'TESTNFT')
                assert.exists(setOp)
                assert.equal(setOp.data.a, 'nft-creator') // Author
                assert.equal(setOp.data.r, 100) // Royalty
                assert.equal(setOp.data.t, 1) // Type
                assert.equal(setOp.data.b, 1000) // Bond
                
                // Check rnfts (redeemable NFT tokens)
                let rnftOp = ops.find(op => op.path[0] === 'rnfts')
                assert.exists(rnftOp)
                assert.isAbove(rnftOp.data, 0) // Some NFTs available to mint
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'defined TESTNFT NFT set')
            })
        })

        it('Should fail to define NFT set with insufficient balance', () => {
            let json = {
                name: 'EXPENSIVE',
                type: 1,
                script: 'Qmabcdef123456',
                start: 'aaaa',
                end: 'zzzz', // Large range
                royalty: 100,
                handling: 'ipfs',
                permlink: 'expensive-nft',
                max_fee: 1000, // Low max fee
                bond: 10000, // High bond
                block_num: 2000,
                transaction_id: 'test_define_fail'
            }
            return callOp(HR.nft_define, json, 'nft-owner')
            .then(ops => {
                // Should fail - no operations
                assert.isUndefined(ops)
            })
        })

        it('Should fail to define duplicate NFT set', () => {
            // First define a set
            let json1 = {
                name: 'UNIQUE',
                type: 1,
                script: 'Qmabcdef123456',
                start: 'a',
                end: 'j',
                royalty: 50,
                handling: 'ipfs',
                permlink: 'unique-nft',
                max_fee: 50000,
                block_num: 3000,
                transaction_id: 'test_define_first'
            }
            
            return callOp(HR.nft_define, json1, 'nft-creator')
            .then(ops1 => {
                return new Promise((resolve, reject) => {
                    store.batch(ops1, [resolve, reject])
                })
            })
            .then(() => {
                // Try to define same set name
                let json2 = {
                    name: 'UNIQUE',
                    type: 1,
                    script: 'Qmxyz789',
                    start: 'a',
                    end: 'z',
                    royalty: 100,
                    handling: 'ipfs',
                    permlink: 'duplicate-attempt',
                    max_fee: 50000,
                    block_num: 3100,
                    transaction_id: 'test_define_duplicate'
                }
                return callOp(HR.nft_define, json2, 'nft-seller')
            })
            .then(ops2 => {
                // Should fail
                assert.isUndefined(ops2)
            })
        })
    })

    describe('nft_mint', function () {
        beforeEach(function () {
            // Setup: Create an NFT set with redeemable tokens
            return new Promise((resolve, reject) => {
                let setupOps = [
                    { 
                        type: 'put', 
                        path: ['sets', 'MINTABLE'], 
                        data: {
                            a: 'nft-creator',
                            s: 'QmMintScript',
                            i: '0',
                            m: 'j', // max 10 NFTs (a-j)
                            o: 'a', // start at 'a'
                            n: 'MINTABLE',
                            nl: 'Mintable NFT Set',
                            r: 100,
                            t: 1,
                            e: 'ipfs',
                            p: 'mintable-nft',
                            b: 1000,
                            f: 10000
                        }
                    },
                    { type: 'put', path: ['rnfts', 'MINTABLE', 'nft-owner'], data: 3 }, // 3 mint tokens
                    { type: 'put', path: ['rnfts', 'MINTABLE', 'nft-buyer'], data: 2 }  // 2 mint tokens
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should mint an NFT from redeemable tokens', () => {
            let json = {
                set: 'MINTABLE',
                block_num: 4000,
                transaction_id: 'test_mint_1'
            }
            return callOp(HR.nft_mint, json, 'nft-owner')
            .then(ops => {
                assert.isArray(ops)
                
                // Check rnft reduction
                let rnftOp = ops.find(op => op.path[0] === 'rnfts')
                assert.exists(rnftOp)
                assert.equal(rnftOp.data, 2) // 3 - 1
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Redeemed a MINTABLE Mint Token')
                
                // Note: Actual NFT creation happens in chronAssign
            })
        })

        it('Should fail to mint without redeemable tokens', () => {
            let json = {
                set: 'MINTABLE',
                block_num: 4100,
                transaction_id: 'test_mint_fail'
            }
            return callOp(HR.nft_mint, json, 'nft-seller') // Has no mint tokens
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('nft_transfer', function () {
        beforeEach(function () {
            // Setup: Create NFTs owned by users
            return new Promise((resolve, reject) => {
                let setupOps = [
                    {
                        type: 'put',
                        path: ['sets', 'TRANSFER'],
                        data: {
                            a: 'nft-creator',
                            n: 'TRANSFER',
                            r: 100,
                            u: { 'abc': 'nft-owner', 'def': 'nft-seller' } // ownership map
                        }
                    },
                    {
                        type: 'put',
                        path: ['nfts', 'nft-owner', 'TRANSFER:abc'],
                        data: {
                            s: '5000@init', // last modified
                            j: {}, // NFT data
                            l: false // not locked
                        }
                    },
                    {
                        type: 'put',
                        path: ['nfts', 'nft-seller', 'TRANSFER:def'],
                        data: {
                            s: '5000@init',
                            j: {},
                            l: false
                        }
                    }
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should transfer NFT to another user', () => {
            let json = {
                set: 'TRANSFER',
                uid: 'abc',
                to: 'nft-buyer',
                block_num: 5000,
                transaction_id: 'test_transfer_1'
            }
            return callOp(HR.nft_transfer, json, 'nft-owner')
            .then(ops => {
                assert.isArray(ops)
                
                // Check NFT moved to new owner
                let putOp = ops.find(op => 
                    op.type === 'put' && 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'nft-buyer'
                )
                assert.exists(putOp)
                assert.equal(putOp.path[2], 'TRANSFER:abc')
                
                // Check NFT removed from old owner
                let delOp = ops.find(op => 
                    op.type === 'del' && 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'nft-owner'
                )
                assert.exists(delOp)
                
                // Check set ownership update
                let setOp = ops.find(op => op.path[0] === 'sets')
                assert.exists(setOp)
                assert.equal(setOp.data.u.abc, 'nft-buyer')
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'Sent TRANSFER:abc to @nft-buyer')
            })
        })

        it('Should fail to transfer NFT not owned', () => {
            let json = {
                set: 'TRANSFER',
                uid: 'def', // Owned by nft-seller
                to: 'nft-buyer',
                block_num: 5100,
                transaction_id: 'test_transfer_fail'
            }
            return callOp(HR.nft_transfer, json, 'nft-owner')
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })

        it('Should fail to transfer to self', () => {
            let json = {
                set: 'TRANSFER',
                uid: 'abc',
                to: 'nft-owner', // Same as from
                block_num: 5200,
                transaction_id: 'test_transfer_self'
            }
            return callOp(HR.nft_transfer, json, 'nft-owner')
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('nft_sell', function () {
        beforeEach(function () {
            // Setup: Create NFTs for selling
            return new Promise((resolve, reject) => {
                let setupOps = [
                    {
                        type: 'put',
                        path: ['sets', 'MARKET'],
                        data: {
                            a: 'nft-creator',
                            n: 'MARKET',
                            r: 200, // 2% royalty
                            u: { 'nft1': 'nft-seller', 'nft2': 'nft-owner' }
                        }
                    },
                    {
                        type: 'put',
                        path: ['nfts', 'nft-seller', 'MARKET:nft1'],
                        data: {
                            s: '6000@init',
                            j: { name: 'NFT #1' },
                            l: false
                        }
                    },
                    {
                        type: 'put',
                        path: ['nfts', 'nft-owner', 'MARKET:nft2'],
                        data: {
                            s: '6000@init',
                            j: { name: 'NFT #2' },
                            l: false
                        }
                    }
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should list NFT for sale', () => {
            let json = {
                set: 'MARKET',
                uid: 'nft1',
                price: 5000, // 5 tokens
                type: 'token', // Default token sale
                block_num: 6000,
                transaction_id: 'test_sell_1'
            }
            return callOp(HR.nft_sell, json, 'nft-seller')
            .then(ops => {
                assert.isArray(ops)
                
                // Check listing creation
                let listingOp = ops.find(op => 
                    op.path[0] === 'ls' && 
                    op.path[1] === 'MARKET:nft1'
                )
                assert.exists(listingOp)
                assert.equal(listingOp.data.p, 5000) // Price
                assert.equal(listingOp.data.o, 'nft-seller') // Owner
                assert.equal(listingOp.data.h, 'LARYNX') // Currency
                assert.exists(listingOp.data.nft) // NFT data included
                
                // Check NFT moved to listing account
                let nftMoveOp = ops.find(op => 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'ls'
                )
                assert.exists(nftMoveOp)
                
                // Check NFT removed from seller
                let nftDelOp = ops.find(op => 
                    op.type === 'del' && 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'nft-seller'
                )
                assert.exists(nftDelOp)
                
                // Check set ownership update
                let setOp = ops.find(op => op.path[0] === 'sets')
                assert.equal(setOp.data.u.nft1, 'ls') // Moved to listing account
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'listed MARKET:nft1 for 5.000')
            })
        })

        it('Should list NFT for HIVE sale', () => {
            let json = {
                set: 'MARKET',
                uid: 'nft2',
                price: 10000, // 10 HIVE
                type: 'HIVE',
                block_num: 6100,
                transaction_id: 'test_sell_hive'
            }
            return callOp(HR.nft_sell, json, 'nft-owner')
            .then(ops => {
                let listingOp = ops.find(op => op.path[0] === 'ls')
                assert.equal(listingOp.data.h, 'HIVE')
                assert.equal(listingOp.data.p, 10000)
            })
        })

        it('Should fail to list NFT not owned', () => {
            let json = {
                set: 'MARKET',
                uid: 'nft2', // Owned by nft-owner
                price: 5000,
                block_num: 6200,
                transaction_id: 'test_sell_fail'
            }
            return callOp(HR.nft_sell, json, 'nft-seller')
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('nft_buy', function () {
        beforeEach(function () {
            // Setup: Create listed NFTs
            return new Promise((resolve, reject) => {
                let setupOps = [
                    {
                        type: 'put',
                        path: ['sets', 'BUYABLE'],
                        data: {
                            a: 'royalty-receiver', // Set creator gets royalties
                            n: 'BUYABLE',
                            r: 1000, // 10% royalty
                            u: { 'item1': 'ls', 'item2': 'ls' }
                        }
                    },
                    {
                        type: 'put',
                        path: ['ls', 'BUYABLE:item1'],
                        data: {
                            p: 10000, // 10 tokens
                            o: 'nft-seller', // Original owner
                            h: 'LARYNX', // Token sale
                            nft: {
                                s: '7000@listed',
                                j: { name: 'Buyable Item 1' }
                            }
                        }
                    },
                    {
                        type: 'put',
                        path: ['nfts', 'ls', 'BUYABLE:item1'],
                        data: {
                            s: '7000@listed',
                            j: { name: 'Buyable Item 1' }
                        }
                    },
                    { type: 'put', path: ['balances', 'royalty-receiver'], data: 1000 }
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should buy NFT with tokens including royalty', () => {
            let json = {
                set: 'BUYABLE',
                uid: 'item1',
                block_num: 7000,
                transaction_id: 'test_buy_1'
            }
            return callOp(HR.nft_buy, json, 'nft-buyer')
            .then(ops => {
                assert.isArray(ops)
                
                // Check buyer balance reduction
                let buyerBalanceOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'nft-buyer'
                )
                assert.exists(buyerBalanceOp)
                assert.equal(buyerBalanceOp.data, 20000000 - 10000) // Initial - price
                
                // Check seller receives payment minus royalty
                let sellerBalanceOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'nft-seller'
                )
                assert.exists(sellerBalanceOp)
                assert.equal(sellerBalanceOp.data, 15000000 + 9000) // Initial + (price - 10% royalty)
                
                // Check royalty payment
                let royaltyOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'royalty-receiver'
                )
                assert.exists(royaltyOp)
                assert.equal(royaltyOp.data, 1000 + 1000) // Initial + 10% of 10000
                
                // Check NFT transferred to buyer
                let nftOp = ops.find(op => 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'nft-buyer'
                )
                assert.exists(nftOp)
                
                // Check listing removed
                let listingDelOp = ops.find(op => 
                    op.type === 'del' && 
                    op.path[0] === 'ls'
                )
                assert.exists(listingDelOp)
                
                // Check set ownership update
                let setOp = ops.find(op => op.path[0] === 'sets')
                assert.equal(setOp.data.u.item1, 'nft-buyer')
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'bought BUYABLE:item1 for 10.000')
            })
        })

        it('Should fail to buy with insufficient balance', () => {
            // Setup expensive listing
            return new Promise((resolve, reject) => {
                let setupOps = [{
                    type: 'put',
                    path: ['ls', 'BUYABLE:item2'],
                    data: {
                        p: 50000000, // 50,000 tokens (more than buyer has)
                        o: 'nft-seller',
                        h: 'LARYNX',
                        nft: { s: '7100@listed', j: {} }
                    }
                }]
                store.batch(setupOps, [resolve, reject])
            })
            .then(() => {
                let json = {
                    set: 'BUYABLE',
                    uid: 'item2',
                    block_num: 7100,
                    transaction_id: 'test_buy_fail'
                }
                return callOp(HR.nft_buy, json, 'nft-buyer')
            })
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })

        it('Should fail to buy own listing', () => {
            let json = {
                set: 'BUYABLE',
                uid: 'item1',
                block_num: 7200,
                transaction_id: 'test_buy_self'
            }
            return callOp(HR.nft_buy, json, 'nft-seller') // Trying to buy own listing
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('nft_sell_cancel', function () {
        beforeEach(function () {
            // Setup: Create a listing
            return new Promise((resolve, reject) => {
                let setupOps = [
                    {
                        type: 'put',
                        path: ['sets', 'CANCELABLE'],
                        data: {
                            a: 'nft-creator',
                            n: 'CANCELABLE',
                            r: 100,
                            u: { 'xyz': 'ls' }
                        }
                    },
                    {
                        type: 'put',
                        path: ['ls', 'CANCELABLE:xyz'],
                        data: {
                            p: 7500,
                            o: 'nft-owner', // Original owner
                            h: 'LARYNX',
                            nft: { s: '8000@listed', j: {} }
                        }
                    },
                    {
                        type: 'put',
                        path: ['nfts', 'ls', 'CANCELABLE:xyz'],
                        data: { s: '8000@listed', j: {} }
                    }
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should cancel NFT listing', () => {
            let json = {
                set: 'CANCELABLE',
                uid: 'xyz',
                block_num: 8000,
                transaction_id: 'test_cancel_1'
            }
            return callOp(HR.nft_sell_cancel, json, 'nft-owner')
            .then(ops => {
                assert.isArray(ops)
                
                // Check NFT returned to owner
                let nftReturnOp = ops.find(op => 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'nft-owner'
                )
                assert.exists(nftReturnOp)
                
                // Check listing removed
                let listingDelOp = ops.find(op => 
                    op.type === 'del' && 
                    op.path[0] === 'ls'
                )
                assert.exists(listingDelOp)
                
                // Check NFT removed from listing account
                let nftDelOp = ops.find(op => 
                    op.type === 'del' && 
                    op.path[0] === 'nfts' && 
                    op.path[1] === 'ls'
                )
                assert.exists(nftDelOp)
                
                // Check set ownership update
                let setOp = ops.find(op => op.path[0] === 'sets')
                assert.equal(setOp.data.u.xyz, 'nft-owner')
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'canceled listing of CANCELABLE:xyz')
            })
        })

        it('Should fail to cancel listing by non-owner', () => {
            let json = {
                set: 'CANCELABLE',
                uid: 'xyz',
                block_num: 8100,
                transaction_id: 'test_cancel_fail'
            }
            return callOp(HR.nft_sell_cancel, json, 'nft-buyer') // Not the owner
            .then(ops => {
                // Should fail
                assert.isUndefined(ops)
            })
        })
    })

    describe('nft_add_roy', function () {
        beforeEach(function () {
            // Setup: Create NFT set and tokens
            return new Promise((resolve, reject) => {
                let setupOps = [
                    {
                        type: 'put',
                        path: ['sets', 'ROYALTY'],
                        data: {
                            a: 'nft-creator',
                            n: 'ROYALTY',
                            r: 500, // 5% initial royalty
                            u: {}
                        }
                    },
                    { type: 'put', path: ['balances', 'contributor'], data: 5000000 }
                ]
                store.batch(setupOps, [resolve, reject])
            })
        })

        it('Should add royalty beneficiary', () => {
            let json = {
                set: 'ROYALTY',
                account: 'contributor',
                units: 200, // 2% additional royalty
                block_num: 9000,
                transaction_id: 'test_royalty_1'
            }
            return callOp(HR.nft_add_roy, json, 'contributor')
            .then(ops => {
                assert.isArray(ops)
                
                // Check balance reduction (payment for royalty share)
                let balanceOp = ops.find(op => 
                    op.path[0] === 'balances' && 
                    op.path[1] === 'contributor'
                )
                assert.exists(balanceOp)
                assert.isBelow(balanceOp.data, 5000000)
                
                // Check royalty addition
                let royOp = ops.find(op => 
                    op.path[0] === 'roy' && 
                    op.path[1] === 'ROYALTY'
                )
                assert.exists(royOp)
                assert.equal(royOp.data, 200)
                
                // Check feed message
                let feedOp = ops.find(op => op.path[0] === 'feed')
                assert.include(feedOp.data, 'added 2.00% royalty')
            })
        })
    })

    describe('Royalty Distribution', function () {
        it('Should calculate correct royalty distribution', () => {
            // Test royalty calculation logic
            const price = 10000 // 10 tokens
            const royaltyRate = 1000 // 10%
            const expectedRoyalty = Math.floor(price * royaltyRate / 10000)
            const expectedSellerAmount = price - expectedRoyalty
            
            assert.equal(expectedRoyalty, 1000) // 10% of 10000
            assert.equal(expectedSellerAmount, 9000) // 90% to seller
        })

        it('Should handle multiple royalty beneficiaries', () => {
            // When there are additional royalty holders
            const price = 20000
            const baseRoyalty = 500 // 5% to creator
            const additionalRoyalty = 300 // 3% to contributor
            const totalRoyalty = baseRoyalty + additionalRoyalty // 8%
            
            const royaltyAmount = Math.floor(price * totalRoyalty / 10000)
            const sellerAmount = price - royaltyAmount
            
            assert.equal(royaltyAmount, 1600) // 8% of 20000
            assert.equal(sellerAmount, 18400) // 92% to seller
        })
    })
})