const assert = require('chai').assert
const app = require('./../processing_routes/index')
const { tally } = require('./../tally')
const { store } = require('./../index')
const test_state = require('./test_state')
const config = require('./../config')
const dex = require('./../processing_routes/dex')
const { Base64 } = require('./../helpers')

function init() {
    return new Promise((resolve, reject) => {
        store.del([], function(e) {
            if (e) { console.log(e) }
            store.put([], test_state, function(err) {
                if (err) reject(err)
                resolve(true)
            })
        })
    })
}

describe('State', function() {
    this.timeout(10000);
    it('DB init:', function() {
        return init()
            .then(res => assert.equal(res, true))
    })

    it('Add test node A:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 2001,
            marketingRate: -1,
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.node_add(json, 'node-opa', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opa')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 2000)
                assert.equal(ops[0].data.marketingRate, 0)
            })
    })

    it('Add test node B:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 1000,
            marketingRate: 'shrimp',
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.node_add(json, 'node-opb', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opb')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 1000)
                assert.equal(ops[0].data.marketingRate, 0)
            })
    })

    it('Add test node D:', () => {
        let json = {
            domain: 'localhost',
            bidRate: 1,
            marketingRate: 1,
            escrow: true,
            block_num: 1,
            transaction_id: 1
        }
        return new Promise((resolve, reject) => {
                app.node_add(json, 'node-opd', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].path[2], 'node-opd')
                assert.equal(ops[0].data.domain, 'localhost')
                assert.equal(ops[0].data.bidRate, 1)
                assert.equal(ops[0].data.marketingRate, 1)
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
                app.send(json, 'test-from', true, [resolve, reject])
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
                app.send(json, 'test-from', true, [resolve, reject])
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
                app.send(json, 'test-from', true, [resolve, reject])
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
                app.gov_up(json, 'node-opb', true, [resolve, reject])
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
                app.gov_up(json, 'node-opa', true, [resolve, reject])
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
                app.gov_up(json, 'leader', true, [resolve, reject])
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
                app.gov_up(json, 'node-opd', true, [resolve, reject])
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
                app.send(json, 'test-from', true, [resolve, reject])
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
                app.send(json, 'test-from', true, [resolve, reject])
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
                app.send(json, 'test-from', true, [resolve, reject])
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
                app.send(json, 'test-from', true, [resolve, reject])
            })
            .then(ops => {
                assert.equal(ops[0].data, '@test-from| Invalid send operation')
            })
    })

    it('Build consensus Leader:', () => {
        let json = {
            hash: 'hash',
            block: 50499901,
            block_num: 50499999,
            transaction_id: '5L'
        }
        return new Promise((resolve, reject) => {
                app.report(json, 'leader', true, [resolve, reject])
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
                app.report(json, 'node-opa', true, [resolve, reject])
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
                app.report(json, 'node-opb', true, [resolve, reject])
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
                app.report(json, 'node-opd', true, [resolve, reject])
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
                app.report(json, 'test-to', true, [resolve, reject])
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
                    assert.equal(ops.stats.larynxSupply, 203000096)
                    assert.equal(ops.stats.multiSigCollateral, 80000)
                    store.get(['markets', 'node', 'leader'], function(e, r) {
                        console.log(r)

                    })
                })
        })
})

describe('DEX Tests', function() {
    this.timeout(15000);
    const user_a = 'test-seller';
    const user_b = 'test-buyer';
    const defaultToken = config.jsonTokenName;
    const block_num = 50500001;
    let tx_id_counter = 1;

    before('Initialize DEX balances', () => {
        const initial_ops = [
            { type: 'put', path: ['balances', user_a], data: 100000 },
            { type: 'put', path: ['balances', user_b], data: 0 },
            { type: 'put', path: ['dex', 'hive'], data: { buyBook: '', sellBook: '', buyOrders: {}, sellOrders: {}, tick: '0.100000', his: {} } },
            { type: 'put', path: ['dex', 'hbd'], data: { buyBook: '', sellBook: '', buyOrders: {}, sellOrders: {}, tick: '1.000000', his: {} } },
            { type: 'del', path: ['contracts', user_a] },
            { type: 'del', path: ['contracts', user_b] }
        ];
        return new Promise((resolve, reject) => {
            store.batch(initial_ops, [resolve, reject]);
        });
    });

    it('Place a LARYNX:HIVE limit sell order', () => {
        const sellAmount = 50000;
        const hiveAmount = 5000;
        const rate = (hiveAmount / sellAmount).toFixed(6);
        const current_tx_id = `dex-sell-${tx_id_counter++}`;
        let json = {
            [defaultToken]: sellAmount,
            hive: hiveAmount,
            hours: 1,
            block_num: block_num,
            transaction_id: current_tx_id,
            timestamp: new Date().toISOString()
        };
        
        if(!json[config.jsonTokenName]) {
            console.error(`Error: config.jsonTokenName ('${config.jsonTokenName}') not found in json object for sell order.`);
            json[config.jsonTokenName] = sellAmount;
        }

        let sell_ops = [];
        return new Promise((resolve, reject) => {
            dex.dex_sell(json, user_a, true, [resolve, reject, sell_ops]); 
        })
        .then(() => {
            console.log(sell_ops)
            assert.ok(sell_ops.length > 0, 'Should generate operations');
            
            const balance_op = sell_ops.find(op => op.path[0] === 'balances' && op.path[1] === user_a);
            assert.ok(balance_op, 'Seller balance update operation not found');
            assert.equal(balance_op.data, 100000 - sellAmount, 'Seller balance should be reduced');

            const dex_op = sell_ops.find(op => op.path[0] === 'dex' && op.path[1] === 'hive');
            assert.ok(dex_op, 'DEX state update operation not found');
            assert.ok(dex_op.data.sellBook.includes(rate), 'Sell book should contain the order rate');
            const orderKey = Object.keys(dex_op.data.sellOrders).find(key => key.startsWith(rate));
            assert.ok(orderKey, 'Sell order should be added to sellOrders');
            assert.equal(dex_op.data.sellOrders[orderKey].from, user_a);
            assert.equal(dex_op.data.sellOrders[orderKey].amount, sellAmount);
            assert.equal(dex_op.data.sellOrders[orderKey].hive, hiveAmount);
            
            const contract_op = sell_ops.find(op => op.path[0] === 'contracts' && op.path[1] === user_a);
            assert.ok(contract_op, 'Contract creation operation not found');
            assert.equal(contract_op.data.from, user_a);
            assert.equal(contract_op.data.amount, sellAmount);
            assert.equal(contract_op.data.rate, rate);
            assert.equal(contract_op.data.type, 'hive:sell');
            const contractTxId = contract_op.path[2];
            assert.ok(contractTxId.startsWith(config.TOKEN), 'Contract txid should start with token name');

            const chrono_op = sell_ops.find(op => op.path[0] === 'chrono');
            assert.ok(chrono_op, 'Chrono operation for expiration not found');
            assert.equal(chrono_op.data.op, 'expire');
            assert.equal(chrono_op.data.from, user_a);
            assert.equal(chrono_op.data.txid, contractTxId);

            const feed_op = sell_ops.find(op => op.path[0] === 'feed' && op.path[1].startsWith(`${block_num}:${current_tx_id}`));
            assert.ok(feed_op, 'Feed message operation not found');
            assert.include(feed_op.data, `@${user_a} is selling`);

            return store.get(['dex', 'hive']);
        })
        .then(dexState => {
            assert.ok(dexState.sellBook.length > 0, 'Sell book should not be empty in store');
            const orderKey = Object.keys(dexState.sellOrders).find(key => key.startsWith(rate));
            assert.ok(orderKey, 'Sell order should exist in store');
        });
    });

});