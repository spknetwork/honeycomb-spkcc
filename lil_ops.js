const { store } = require('./index')
const { getPathObj, getPathNum } = require('./getPathObj')
const crypto = require('crypto');
const bs58 = require('bs58');
const hashFunction = Buffer.from('12', 'hex');
const stringify = require('json-stable-stringify');
const { postToDiscord } = require('./discord');
const config = require('./config');

const burn = (amount) => {
    return new Promise((resolve, reject) => {
        getPathNum(['stats', 'tokenSupply'])
            .then(sup => {
                store.batch([{ type: 'put', path: ['stats', 'tokenSupply'], data: sup - amount }], [resolve, reject, 1])
            })
    })
}
exports.burn = burn
const forceCancel = (rate, type, block_num) => {
    return new Promise((resolve, reject) => {
        const price = parseFloat(rate)
        let Ps = getPathObj(['dex', type, 'sellOrders'])
        let Pb = getPathObj(['dex', type, 'buyOrders'])
        Promise.all([Ps, Pb])
            .then(s => {
                let gone = 0
                for (o in s[0]) {
                    if (parseFloat(o.split(":")[0]) < (price * .6)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    } else if (parseFloat(o.split(":")[0]) > (price * 1.4)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    }
                }
                for (o in s[1]) {
                    if (parseFloat(o.split(":")[0]) < (price * .6)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    } else if (parseFloat(o.split(":")[0]) > (price * 1.4)) {
                        gone++
                        release(o.from, o.split(":")[1], block_num)
                    }
                }
                resolve(gone)
            })
            .catch(e => { reject(e) })
    })
}
exports.forceCancel = forceCancel

const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
    const last_calc = require('./helpers').Base64.toNumber(last.split(',')[1])
    const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc))/(pow * 1000))
    var total = parseInt(last.split(',')[0]) + accured + add
    if(total > (pow * 1000))total = (pow * 1000)
    return `${total},${require("./helpers").Base64.fromNumber(bn)}`
}

exports.broca_calc = broca_calc

const reward_spk = (acc, bn) => {
    return new Promise((res, rej) => {
        const Pblock = getPathNum(["spkb", acc]);
        const Pstats = getPathObj(["stats"]);
        const Ppow = getPathNum(["pow", acc]);
        const Pgranted = getPathNum(["granted", acc, "t"]);
        const Pgranting = getPathNum(["granting", acc, "t"]);
        const Pgov = getPathNum(["gov", acc]);
        const Pspk = getPathNum(['spk', acc])
        const Pspkt = getPathNum(['spk', 't'])
        Promise.all([Pblock, Pstats, Ppow, Pgranted, Pgranting, Pgov, Pspk, Pspkt]).then(
            (mem) => {
                var block = mem[0],
                    diff = bn - block,
                    stats = mem[1],
                    pow = mem[2],
                    granted = mem[3],
                    granting = mem[4],
                    gov = mem[5],
                    spk = mem[6],
                    spkt = mem[7],
                    r = 0, a = 0, b = 0, c = 0, t = 0
                if (!block){
                    store.batch(
                      [
                        {
                          type: "put",
                          path: ["spkb", acc],
                          data: bn,
                        },
                      ],
                      [res, rej, 0]
                    );
                } else if(diff < 28800){ //min claim period
                    res(r)
                } else {
                    t = parseInt(diff/28800)
                    a = simpleInterest(gov, t, stats.spk_rate_lgov)
                    b = simpleInterest(pow, t, stats.spk_rate_lpow);
                    c = simpleInterest(
                      (granted + granting),
                      t,
                      stats.spk_rate_ldel
                    );
                    const i = a + b + c
                    if(i){
                        store.batch(
                          [
                            {
                              type: "put",
                              path: ["spk", acc],
                              data: spk + i,
                            },
                            {
                              type: "put",
                              path: ["spk", "t"],
                              data: spkt + i,
                            },
                            {
                              type: "put",
                              path: ["spkb", acc],
                              data: bn - (diff % 28800),
                            },
                          ],
                          [res, rej, i]
                        );
                    } else {
                        res(0)
                    }
                }

            }
        );
    })
}

exports.reward_spk = reward_spk

const simpleInterest = (p, t, r) => {
  const amount = p * (1 + r / 365);
  const interest = amount - p;
  return parseInt(interest * t);
};

const add = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['balances', node], function (e, a) {
            if (!e) {
                console.log(amount + ' to ' + node)
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log('final balance ' + a2)
                store.batch([{ type: 'put', path: ['balances', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.add = add

const addc = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['cbalances', node], function (e, a) {
            if (!e) {
                console.log(amount + ' to ' + node)
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log('final balance ' + a2)
                store.batch([{ type: 'put', path: ['cbalances', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addc = addc

const addMT = (path, amount) => {
    return new Promise((resolve, reject) => {
        store.get(path, function (e, a) {
            if (!e) {
                const a2 = typeof a != 'number' ? parseInt(amount) : parseInt(a) + parseInt(amount)
                console.log(`MTo:${a},add:${amount},final:${a2}`,)
                store.batch([{ type: 'put', path, data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addMT = addMT

const addCol = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['col', node], function (e, a) {
            if (!e) {
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log({ node, a })
                store.batch([{ type: 'put', path: ['col', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addCol = addCol

const addGov = (node, amount) => {
    return new Promise((resolve, reject) => {
        store.get(['gov', node], function (e, a) {
            if (!e) {
                const a2 = typeof a != 'number' ? amount : a + amount
                console.log({ node, a })
                store.batch([{ type: 'put', path: ['gov', node], data: a2 }], [resolve, reject, 1])
            } else {
                console.log(e)
            }
        })
    })
}
exports.addGov = addGov

const deletePointer = (escrowID, user) => {
    return new Promise((resolve, reject) => {
        const escrow_id = typeof escrowID == 'string' ? escrowID : escrowID.toString()
        store.get(['escrow', escrow_id], function (e, a) {
            if (!e) {
                var found = false
                const users = Object.keys(a)
                for (i = 0; i < users.length; i++) {
                    if (user = users[i]) {
                        found = true
                        break
                    }
                }
                if (found && users.length == 1) {
                    store.batch([{ type: 'del', path: ['escrow', escrow_id] }], [resolve, reject, users.length])
                } else if (found) {
                    store.batch([{ type: 'del', path: ['escrow', escrow_id, user] }], [resolve, reject, users.length])
                }
            }
        })
    })
}
exports.deletePointer = deletePointer

const credit = (node) => {
    return new Promise((resolve, reject) => {
        getPathNum(['markets', 'node', node, 'wins'])
            .then(a => {
                store.batch([{ type: 'put', path: ['markets', 'node', node, 'wins'], data: a++ }], [resolve, reject, 1])
            })
            .catch(e => {
                reject(e)
            })
    })
}
exports.credit = credit


const nodeUpdate = (node, op, val) => {
    return new Promise((resolve, reject) => {
        store.get(['markets', 'node', node], function (e, a) {
            if (!e) {
                if (!a.strikes)
                    a.strikes = 0
                if (!a.burned)
                    a.burned = 0
                if (!a.moved)
                    a.moved = 0
                switch (op) {
                    case 'strike':
                        a.strikes++
                        a.burned += val
                        break
                    case 'ops':
                        a.escrows++
                        a.moved += val
                        break
                    default:
                }
                store.batch([{ type: 'put', path: ['markets', 'node', node], data: a }], [resolve, reject, 1])
            } else {
                console.log(e)
                resolve()
            }
        })
    })
}
exports.nodeUpdate = nodeUpdate

const penalty = (node, amount) => {
    console.log('penalty: ', { node, amount })
    return new Promise((resolve, reject) => {
        pts = getPathNum(['gov', node])
        Promise.all([pts]).then(r => {
            var a2 = r[1]
            newBal = a2 - amount
            if (newBal < 0) { newBal = 0 }
            const forfiet = a2 - newBal
            var ops = [{ type: 'put', path: ['gov', node], data: newBal }]
            nodeUpdate(node, 'strike', amount)
                .then(empty => {
                    store.batch(ops, [resolve, reject, forfiet])
                })
                .catch(e => { reject(e) })
        }).catch(e => {
            reject(e)
        })
    })
}
exports.penalty = penalty

const chronAssign = (block, op) => {
    return new Promise((resolve, reject) => {
        const t = block + ':' + hashThis(stringify(op))
        store.batch([{ type: 'put', path: ['chrono', t], data: op }], [resolve, reject, t])
    })
}
exports.chronAssign = chronAssign

function hashThis(data) {
    const digest = crypto.createHash('sha256').update(data).digest()
    const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex')
    const combined = Buffer.concat([hashFunction, digestSize, digest])
    const multihash = bs58.encode(combined)
    return multihash.toString()
}
exports.hashThis = hashThis

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) return false;
    }
    return true
}
exports.isEmpty = isEmpty;