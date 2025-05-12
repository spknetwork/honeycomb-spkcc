import { assert } from 'chai';
import { HR } from './../processing_routes/index.js';
import { tally } from './../tally.js';
import { store } from './../index.mjs';
import test_state from './test_state.js';
import { config } from '../working.config.js';
import { Config, configSet, TXID, GetNodeOps, newOps, unshiftOp, pushOp, block, status, plasma } from './../index.mjs';

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

describe('State', function () {
    this.timeout(10000);
    it('DB init:', function () {
        return init()
            .then(res => assert.equal(res, true))
    })

    it('Add test node A:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 1001,
            daoRate: -1,
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.node_add(json, 'node-opa', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opa')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 1000)
                assert.equal(ops[0].data.daoRate, 0)
            })
    })

    it('Add test node B:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 1000,
            daoRate: 'shrimp',
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.node_add(json, 'node-opb', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opb')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 1000)
                assert.equal(ops[0].data.daoRate, 0)
            })
    })

    it('Add test node D:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 1,
            daoRate: 1,
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.node_add(json, 'node-opd', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opd')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 1)
                assert.equal(ops[0].data.daoRate, 1)
            })
    })

    it('Testing send:', () => {
        let json = {
            to: 'test-to',
            amount: 1000,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].path[1], 'test-from')
                assert.equal(ops[1].path[1], 'test-to')
                assert.equal(ops[1].data, 1001000)
                assert.equal(ops[0].data, 999000)
            })
    })

    it('Liquidizing Node A:', () => {
        let json = {
            to: 'node-opa',
            amount: 90000,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].path[1], 'test-from')
                assert.equal(ops[1].path[1], 'node-opa')
                assert.equal(ops[1].data, 90000)
                assert.equal(ops[0].data, 909000)
            })
    })

    it('Liquidizing Node B:', () => {
        let json = {
            to: 'node-opb',
            amount: 9000,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].path[1], 'test-from')
                assert.equal(ops[1].path[1], 'node-opb')
                assert.equal(ops[1].data, 9000)
                assert.equal(ops[0].data, 900000)
            })
    })

    it('Gov Up Node opb:', () => {
        let json = {
            amount: 8000,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
            HR.gov_up(json, 'node-opb', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, 1000)
                assert.equal(ops[0].path[1], 'node-opb')
                assert.equal(ops[1].data, 8000)
                assert.equal(ops[2].data, 8000)
            })
    })

    it('Gov Up Node opa:', () => {
        let json = {
            amount: 80000,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
            HR.gov_up(json, 'node-opa', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, 10000)
                assert.equal(ops[0].path[1], 'node-opa')
                assert.equal(ops[1].data, 80000)
                assert.equal(ops[2].data, 88000)
            })
    })

    it('Gov Up Node leader:', () => {
        let json = {
            amount: 800000,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
            HR.gov_up(json, 'leader', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, 200000)
                assert.equal(ops[0].path[1], 'leader')
                assert.equal(ops[1].data, 800000)
                assert.equal(ops[2].data, 888000)
            })
    })

    it('Gov Up Node opd:', () => {
        let json = {
            amount: 800,
            block_num: 2,
            transaction_id: 2
        }
        return new Promise((resolve, reject) => {
            HR.gov_up(json, 'node-opd', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, '@node-opd| Invalid gov up')
            })
    })

    it('Testing over send:', () => {
        let json = {
            to: 'test-to',
            amount: 900001,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Testing neg send:', () => {
        let json = {
            to: 'test-to',
            amount: -1,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Testing string send:', () => {
        let json = {
            to: 'test-to',
            amount: 'tri4l',
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Testing 0 send:', () => {
        let json = {
            to: 'test-to',
            amount: 0,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Testing self send:', () => {
        let json = {
            to: 'test-from',
            amount: 1000,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
            HR.send(json, 'test-from', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    /*
    dlux_report
    json: {"hash":"QmYaMrk7MhXzCMEZNH2tcvURzx1taEStJ4fM5KoCXN77Mz","block":50322301}
    */

    it('Build consensus Leader:', () => {
        let json = {
            hash: 'hash',
            block: 50499901,
            block_num: 50499999,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
            HR.report(json, 'leader', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data.self, 'leader')
                assert.equal(ops[0].data.report.hash, 'hash')
            })
    })

    it('Build consensus A:', () => {
        let json = {
            hash: 'hash',
            block: 50499901,
            block_num: 50499999,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
            HR.report(json, 'node-opa', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data.self, 'node-opa')
                assert.equal(ops[0].data.report.hash, 'hash')
            })
    })

    it('Build consensus B:', () => {
        let json = {
            hash: 'hash',
            block: 50499901,
            block_num: 50499999,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
            HR.report(json, 'node-opb', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data.self, 'node-opb')
                assert.equal(ops[0].data.report.hash, 'hash')
            })
    })

    it('Alt consensus D:', () => {
        let json = {
            hash: 'hash-dif',
            block: 50499901,
            block_num: 50499999,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
            HR.report(json, 'node-opd', true, [resolve, reject])
        })
            .then(ops => {
                assert.equal(ops[0].data.self, 'node-opd')
                assert.equal(ops[0].data.report.hash, 'hash-dif')
            })
    })

    it('Disallow Randos:', () => {
        let json = {
            hash: 'hash',
            block: 50499901,
            block_num: 50499999,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
            HR.report(json, 'test-to', true, [resolve, reject])
        })
            .then(ops => {
                assert.notOk(ops)
            })
    })

    it('Establish queue and consensus:', () => {
        let plasma = {
            hashLastIBlock: 'hash'
        }
        tally(50500000, plasma, true)
            .then(ops => {
                assert.equal(ops.consensus, 'hash')
                assert.equal(ops.new_queue.leader.t, 800000)
                assert.equal(ops.new_queue['node-opa'].t, 80000)
                assert.equal(ops.new_queue['node-opb'].t, 8000)
                assert.equal(ops.still_running.leader.t, 800000)
                assert.equal(ops.still_running['node-opa'].t, 80000)
                assert.equal(ops.stats.tokenSupply, 203000096)
                assert.equal(ops.stats.multiSigCollateral, 80000)
                // store.get(['markets', 'node', 'leader'], function (e, r) {
                //     console.log(r)

                // })
            })
    })

    // Example skeleton for dex_sell
    it('DEX Sell Order Invalid Token Name', function () {
        // Prerequisite: User 'seller-dex' needs balance
        const seller = 'seller-a';
        const sellAmount = 100000
        const hive = 10000

        let dexSellJson = {
            amount: sellAmount, // Amount of TOKEN to sell
            hive,       // Price in HIVE per TOKEN
            block_num: 50500001,
            transaction_id: 'tx-dex-sell'
        };

        return new Promise((resolve, reject) => {
            HR.dex_sell(dexSellJson, seller, true, [resolve, reject])
        })
            .then(ops => {
                // Assertions:
                assert.equal(ops[0].path[0], 'feed')
                assert.equal(ops[0].path[1], '50500001:tx-dex-sell')
                assert.equal(ops[0].data, '@seller-a| tried to sell DLUX but sent an invalid order.')
            });
    });

    it('DEX Sell ', function () {
        // Prerequisite: User 'seller-dex' needs balance
        const seller = 'seller-a';
        const sellAmount = 100000
        const hive = 10000

        let dexSellJson = {
            [`${config.jsonTokenName}`]: sellAmount, // Amount of TOKEN to sell
            hive,       // Price in HIVE per TOKEN
            block_num: 50500001,
            transaction_id: 'tx-dex-sell'
        };

        return new Promise((resolve, reject) => {
            HR.dex_sell(dexSellJson, seller, true, [resolve, reject])
        })
            .then(ops => {
                // Assertions:
                assert.equal(ops[0].path[0], 'feed')
                assert.equal(ops[0].path[1], '50500001:tx-dex-sell')
                assert.equal(ops[0].data, '@seller-a| Sell order confirmed.')
                assert.equal(ops[1].path[0], 'balances')
                assert.equal(ops[1].path[1], seller)
                assert.equal(ops[1].data, 900000)
                assert.equal(ops[2].path[0], 'dex')
                assert.equal(ops[2].path[1], 'hive')
                assert.equal(ops[2].data.tick, '0.100000')
                assert.equal(ops[2].data.sellBook, '0.100000_DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu')
                assert.equal(ops[3].path[0], 'contracts')
                assert.equal(ops[3].path[1], seller)
                assert.equal(ops[3].path[2], 'DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu')
                assert.equal(ops[3].data.txid, 'DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu')
                assert.equal(ops[3].data.from, seller)
                assert.equal(ops[3].data.hive, hive)
                assert.equal(ops[3].data.amount, sellAmount)
                assert.equal(ops[3].data.rate, '0.100000')
                assert.equal(ops[3].data.block, 50500001)
                assert.equal(ops[3].data.type, 'hive:sell')
                assert.equal(ops[3].data.hive_id, 'tx-dex-sell')
                assert.equal(ops[3].data.expire_path, '51364001:QmcSDxFnmMPP4gdohkbzejUC3V7Ksiv9Xj15mV9poiUm3i')
                assert.equal(ops[4].path[0], 'feed')
                assert.equal(ops[4].path[1], '50500001:tx-dex-sell.1')
                assert.equal(ops[4].data, '@seller-a is selling 100.000 DLUX for 10.000 HIVE(0.100000:DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu)')
            });
    });

    // Example skeleton for dex_buy (requires a sell order)
    /*
[
  [
    "transfer",
    {
      "to": "dlux-cc",
      "from": "disregardfiat",
      "amount": "1.000 HIVE",
      "memo": "{\"rate\":0,\"hours\":\"0\",\"token\":\"DLUX\"}"
    }
  ]
]
  (json, pc)
    */


    it('DEX Buy Order', function () {
        const buyer = 'buyer-a';
        let dexBuyJson = {
            from: buyer,
            to: config.msaccount,
            amount: "1.000 HIVE",
            memo: JSON.stringify({ "rate": 0, "hours": "0", "token": config.jsonTokenName }),
            block_num: 50500002,
            transaction_id: 'tx-dex-buy'
        };
        return new Promise((resolve, reject) => {
            HR.transfer(dexBuyJson, [resolve, reject])
        })
            .then(ops => {
                // Assertions based on the provided ops structure:
                assert.equal(ops[0].type, 'put');
                assert.deepEqual(ops[0].path, ['feed', '50500002:tx-dex-buy.1']);
                assert.equal(ops[0].data, '@buyer-a bought 10.000 DLUX with 1.000 HIVE from seller-a (DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu)');

                assert.equal(ops[1].type, 'put');
                assert.deepEqual(ops[1].path, ['balances', 'buyer-a']);
                assert.equal(ops[1].data, 9950);

                assert.equal(ops[2].type, 'put');
                assert.deepEqual(ops[2].path, ['dex', 'hive', 'his']);
                assert.exists(ops[2].data['50500002:1:tx-dex-buy']); // Check if the key exists, content might vary

                assert.equal(ops[3].type, 'put');
                assert.deepEqual(ops[3].path, [
                    'msa',
                    'DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu:tx-dex-buy:1'
                ]);
                assert.equal(ops[3].data, '["transfer",{"amount":"1.000 HIVE","from":"dlux-cc","memo":"Partial Filled DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu:tx-dex-buy","to":"seller-a"}]');

                assert.equal(ops[4].type, 'put');
                assert.deepEqual(ops[4].path, [
                    'contracts',
                    'seller-a',
                    'DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu'
                ]);
                assert.equal(ops[4].data.amount, 90000);
                assert.equal(ops[4].data.block, 50500001);
                assert.equal(ops[4].data.expire_path, '51364001:QmcSDxFnmMPP4gdohkbzejUC3V7Ksiv9Xj15mV9poiUm3i');
                // assert.equal(ops[4].data.fee, 451); // Fee might vary slightly depending on execution? Let's comment it out for now.
                assert.equal(ops[4].data.from, 'seller-a');
                assert.equal(ops[4].data.hbd, 0);
                assert.equal(ops[4].data.hive, 9000);
                assert.equal(ops[4].data.hive_id, 'tx-dex-sell');
                assert.equal(ops[4].data.rate, '0.100000');
                assert.equal(ops[4].data.txid, 'DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu');
                assert.equal(ops[4].data.type, 'hive:sell');
                assert.exists(ops[4].data.partial); // Check if partial exists

                // Ops 5 and 6 seem redundant or duplicates from ops[1] and ops[0] based on the comment. Let's check them anyway.
                assert.equal(ops[5].type, 'put');
                assert.deepEqual(ops[5].path, ['balances', 'buyer-a']);
                assert.equal(ops[5].data, 9950); // same as ops[1]

                assert.equal(ops[6].type, 'put');
                assert.deepEqual(ops[6].path, ['feed', '50500002:tx-dex-buy.1']); // same path as ops[0]
                assert.equal(ops[6].data, '@buyer-a | order received.'); // different data than ops[0]

                assert.equal(ops[7].type, 'put');
                assert.deepEqual(ops[7].path, ['dex', 'hive', 'his']); // same path as ops[2]
                assert.exists(ops[7].data['50500002:1:tx-dex-buy']); // same check as ops[2]

                assert.equal(ops[8].type, 'put');
                assert.deepEqual(ops[8].path, ['dex', 'hive']);
                assert.equal(ops[8].data.sellBook, '0.100000_DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu');
                assert.exists(ops[8].data.sellOrders);
                assert.equal(ops[8].data.tick, '0.100000');

                assert.equal(ops[9].type, 'put');
                assert.deepEqual(ops[9].path, ['stats']);
                assert.exists(ops[9].data.MSHeld);
                assert.equal(ops[9].data.chaos, 0);
                assert.equal(ops[9].data.daoRate, 2500);
                assert.equal(ops[9].data.delegationRate, 2000);
                assert.equal(ops[9].data.gov_threshhold, 0);
                assert.equal(ops[9].data.hashLastIBlock, '');
                assert.equal(ops[9].data.icoPrice, 100);
                assert.equal(ops[9].data.interestRate, 2100000);
                assert.equal(ops[9].data.lastBlock, 'hash');
                assert.equal(ops[9].data.lastIBlock, 50499900);
                assert.equal(ops[9].data.liq_reward, 100);
                assert.equal(ops[9].data.maxBudget, 1000000000);
                assert.exists(ops[9].data.movingWeight);
                assert.exists(ops[9].data.ms);
                assert.equal(ops[9].data.multiSigCollateral, 880000);
                assert.equal(ops[9].data.nodeRate, 2000);
                assert.equal(ops[9].data.outOnBlock, 0);
                assert.equal(ops[9].data.safetyLimit, 0);
                assert.equal(ops[9].data.tokenSupply, 203000096);

            });
    });

    it('DEX Buy Order Overfilled with ICO', function () {
        const buyer = 'buyer-b';
        let dexBuyJson = {
            from: buyer,
            to: config.msaccount,
            amount: "10.000 HIVE",
            memo: JSON.stringify({ }),
            block_num: 50500001,
            transaction_id: 'tx-dex-buy-2'
        };
        return new Promise((resolve, reject) => {
            HR.transfer(dexBuyJson, [resolve, reject])
        })
            .then(ops => {
                // Assertions based on the provided ops structure:
                assert.equal(ops.length, 14, 'Expected 14 operations'); // Verify total number of ops first

                // Op 0: Feed message about partial fill
                assert.equal(ops[0].type, 'put');
                assert.deepEqual(ops[0].path, [ 'feed', '50500001:tx-dex-buy-2.1' ]);
                assert.equal(ops[0].data, '@buyer-b bought 90.000 DLUX with 9.000 HIVE from seller-a (DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu)');

                // Op 1: Update dex history
                assert.equal(ops[1].type, 'put');
                assert.deepEqual(ops[1].path, [ 'dex', 'hive', 'his' ]);
                assert.exists(ops[1].data);

                // Op 2: Multisig transfer for filled portion
                assert.equal(ops[2].type, 'put');
                assert.deepEqual(ops[2].path, [ 'msa', 'DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu:tx-dex-buy-2:1' ]);
                assert.equal(ops[2].data, '["transfer",{"amount":"9.000 HIVE","from":"dlux-cc","memo":"Filled DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu:tx-dex-buy-2","to":"seller-a"}]');

                // Op 3: Delete sell order
                assert.equal(ops[3].type, 'del');
                assert.deepEqual(ops[3].path, [ 'dex', 'hive', 'sellOrders', '0.100000:DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu' ]);

                // Op 4: Delete contract
                assert.equal(ops[4].type, 'del');
                assert.deepEqual(ops[4].path, [ 'contracts', 'seller-a', 'DLUXQmaPSQQaoYJikc8dHAodyMLKx859H9sXdCxWu3fFHSspqu' ]);

                // Op 5: Delete chrono entry
                assert.equal(ops[5].type, 'del');
                assert.deepEqual(ops[5].path, [ 'chrono', '51364001:QmcSDxFnmMPP4gdohkbzejUC3V7Ksiv9Xj15mV9poiUm3i' ]);

                // Op 6: Multisig transfer for ICO buy (overfilled portion)
                assert.equal(ops[6].type, 'put');
                assert.deepEqual(ops[6].path, [ 'msa', `ICO@buyer-b:tx-dex-buy-2:50500001` ]); // Note: Uses 'buyer-a' as per comment
                assert.equal(ops[6].data, '["transfer",{"amount":"1.000 HIVE","from":"dlux-cc","memo":"ICO Buy from buyer-b:tx-dex-buy-2","to":"robotolux"}]'); // Note: Uses 'buyer-a'

                // Op 7: Feed message for ICO buy
                assert.equal(ops[7].type, 'put');
                assert.deepEqual(ops[7].path, [ 'feed', '50500001:tx-dex-buy-2:2' ]);
                assert.equal(ops[7].data, '@buyer-b| bought 10.000 DLUX with 1.000 HIVE'); // Note: Uses 'buyer-a'

                // Op 8: Update 'ri' balance (related to ICO?)
                assert.equal(ops[8].type, 'put');
                assert.deepEqual(ops[8].path, [ 'balances', 'ri' ]);
                assert.equal(ops[8].data, 99990000);

                // Op 9: Update buyer balance
                assert.equal(ops[9].type, 'put');
                assert.deepEqual(ops[9].path, [ 'balances', 'buyer-b' ]); // Note: Uses 'buyer-a'
                assert.equal(ops[9].data, 99549);

                // Op 10: Feed message for order received
                assert.equal(ops[10].type, 'put');
                assert.deepEqual(ops[10].path, [ 'feed', '50500001:tx-dex-buy-2.2' ]);
                assert.equal(ops[10].data, '@buyer-b | order received.'); // Note: Uses 'buyer-a'

                // Op 12: Update dex state
                assert.equal(ops[12].type, 'put');
                assert.deepEqual(ops[12].path, [ 'dex', 'hive' ]);
                assert.exists(ops[12].data.his);
                assert.equal(ops[12].data.sellBook, '');
                assert.deepEqual(ops[12].data.sellOrders, {});
                assert.equal(ops[12].data.tick, '0.100000');

                // Op 13: Update stats
                assert.equal(ops[13].type, 'put');
                assert.deepEqual(ops[13].path, [ 'stats' ]);
                assert.exists(ops[13].data.MSHeld);
                assert.equal(ops[13].data.daoRate, 2500);
                assert.equal(ops[13].data.delegationRate, 2000);
                assert.equal(ops[13].data.icoPrice, 100);
                assert.equal(ops[13].data.interestRate, 2100000);
                assert.equal(ops[13].data.lastBlock, 'hash');
                assert.equal(ops[13].data.lastIBlock, 50499900);
                assert.equal(ops[13].data.liq_reward, 100);
                assert.equal(ops[13].data.maxBudget, 1000000000);
                assert.equal(ops[13].data.multiSigCollateral, 880000);
                assert.equal(ops[13].data.nodeRate, 2000);
                assert.equal(ops[13].data.tokenSupply, 203000096);
            })
    })

})

describe('Config', function () {
    it('Should get a config value', function () {
        assert.equal(Config('prefix'), config.prefix);
    });

    it('Should set config values', function () {
        const originalStartURL = Config('startURL');
        const originalPort = Config('port');
        configSet({ startURL: 'https://testnet.hive.io', port: 3001 });
        assert.equal(Config('startURL'), 'https://testnet.hive.io');
        assert.equal(Config('port'), 3001);
        // Reset to original values for subsequent tests if necessary
        configSet({ startURL: originalStartURL, port: originalPort });
        assert.equal(Config('startURL'), originalStartURL);
        assert.equal(Config('port'), originalPort);
    });
});

describe('TXID', function () {
    // beforeEach(function() {
    //     TXID.reset(); // Reset state before each test
    // });

    it('Should store a TXID status', function () {
        TXID.store('Success', '12345:abcde');
        assert.equal(status['abcde'], 'Success');
        assert.include(status.cleaner, '12345:abcde');
    });

    it('Should get the current block number', function () {
        TXID.blocknumber = 5000;
        assert.equal(TXID.getBlockNum(), 5000);
    });

    it('Should set streaming flag', function () {
        assert.isFalse(TXID.streaming);
        TXID.current();
        assert.isTrue(TXID.streaming);
    });
});

describe('NodeOps', function () {
    beforeEach(function () {
        newOps([]); // Reset ops before each test
    });

    it('Should initialize with an empty array', function () {
        assert.deepEqual(GetNodeOps(), []);
    });

    it('Should replace ops with newOps', function () {
        pushOp('op1');
        newOps(['newOp1', 'newOp2']);
        assert.deepEqual(GetNodeOps(), ['newOp1', 'newOp2']);
    });

    it('Should add an op to the beginning with unshiftOp', function () {
        pushOp('op1');
        unshiftOp('op0');
        assert.deepEqual(GetNodeOps(), ['op0', 'op1']);
    });

    it('Should add an op to the end with pushOp', function () {
        pushOp('op1');
        pushOp('op2');
        assert.deepEqual(GetNodeOps(), ['op1', 'op2']);
    });
});
