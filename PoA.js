const config = require("./config.js");
const { Base64, Base58, Base38 } = require("./helpers");
const fetch = require("node-fetch");
let { getPathObj, getPathNum, getPathSome } = require("./getPathObj");

const PoA = {
    Pending: {
        vals: 0
    },
    Validate: function (block, prand, stats, account = config.username) {
        //get val, match with this account
        let Pval = getPathObj(['val'])
        let Pnode = getPathObj(['markets', 'node', account])
        Promise.all([Pval, Pnode]).then(mem => {
            const val = mem[0],
                node = mem[1]
            if (node.val_code && val[account]) {
                const [gte, lte] = this.getRange(prand, account, val, stats)
                getPathSome(["IPFS"], { gte, lte }).then(items => {
                    var promises = [], toVerify = {}
                    for (var pointer of items) {
                        promises.push(getPathObj(['contract', items[pointer].split(',')[0], items[pointer].split(',')[1]]))
                        const asset = pointer.split("").reverse().join("")
                        toVerify[asset] = {
                            r: pointer,
                            a: asset,
                            fo: items[pointer].split(',')[0],
                            id: items[pointer].split(',')[1]
                        }
                    }
                    if (promises.length) Promise.all(promises).then(contracts => {
                        promises = [], j = []
                        for (var i = 0; i < contracts.length; i++) {
                            for (var item of contracts[i].df) {
                                if (toVerify[item]) {
                                    toVerify[item].n = contracts[i].n
                                    toVerify[item].b = contracts[i].df[item]
                                    toVerify[item].i = i
                                    toVerify[item].v = 0
                                    toVerify[item].npid = {}
                                    for (var node of toVerify[item].n) {
                                        toVerify[item].npid[node] = j.length //?
                                        j.push([item, node])
                                        promises.push(getPathObj(['service', 'IPFS', node]))
                                    }
                                    this.Pending[block % 200] = toVerify
                                }
                            }
                        }
                        Promise.all(promises).then(peerIDs => {
                            for (var i = 0; i < peerIDs.length; i++) {
                                j[i].push(peerIDs[i])
                                this.validate(j[0], j[1], j[2], prand, block).then(res=>{
                                    this.Pending[`${res[5] % 200}`][res[1]].val = res[0]
                                    this.Pending[`${res[5] % 200}`][res[1]].v++
                                    this.Pending.vals++
                                    //check to bundle
                                })
                                .catch(e=>{console.log(e)})
                            }
                        })
                    })
                })
            }
        })
    },
    getRange(prand, account = config.username, val, stats) {
        const cutoff = stats.val_threshold
        var val_total = 0
        for (var n of val) {
            if (val[n] >= cutoff) total += cutoff * 2
            else total += val[n]
        }
        const gte = this.getPrand58(account, prand)
        const range = parseInt(((val[account] >= cutoff ? cutoff * 2 : val[account]) / total) * (stats.total_files * parseInt(stats.vals_target * 10000) / 288) * 7427658739)
        const lte = Base58.fromNumber(Base58.toNumber(start) + range)
        return [gte, lte]
    },
    getPrand58(account, prand) {
        p = prand.split('')
        a = account.split('')
        r = 1n
        for (var i = 0; i < p.length; i++) {
            r = r * BigInt(1 + parseInt(p[i], 16))
        }
        for (var i = 0; i < a.length; i++) {
            r = r * BigInt(1 + Base38.toNumber(a[i]))
        }
        return Base58.fromNumber((r % 7427658739644928).intValue())
    },
    validate: function (cid, name, peerIDs, salt, bn) {
        return new Promise((res, rej) => {
            setTimeout(rej,280000)
            peerids = peerIDs.split(',')
            for (var i = 0; i < peerids.length; i++) {
                var socket = new WebSocketClient(`ws://localhost:3000/validate`);
                socket.addEventListener('open', () => {
                    socket.send(JSON.stringify({ name, cid, peerid: peerids[i], salt }));
                })
                socket.addEventListener('message', (event) => {
                    const data = JSON.parse(event.data);
                    const stepText = document.querySelectorAll('.step-text');
                    if (data.Status === 'Connecting to Peer') {
                        if (config.mode == 'verbose') console.log('Connecting to Peer')
                    } else if (data.Status === 'IpfsPeerIDError') {
                        socket.close()
                        rej(data)
                        if (config.mode == 'verbose') console.log('Error: Invalid Peer ID')
                    } else if (data.Status === 'Connection Error') {
                        Socket.close()
                        rej(data)
                        if (config.mode == 'verbose') console.log('Error: Connection Error')
                    } else if (data.Status === 'Waiting Proof') {
                        if (config.mode == 'verbose') console.log('Waiting Proof', { data })
                    } else if (data.Status === "Validating") {
                        if (config.mode == 'verbose') console.log('Validating', { data })
                    } else if (data.Status === "Validated") {
                        if (config.mode == 'verbose') console.log('Validated', { data })
                    } else if (data.Status === "Validating Proof") {
                        if (config.mode == 'verbose') console.log('Validating Proof', { data })
                    } else if (data.Status === "Proof Validated") {
                        if (config.mode == 'verbose') console.log('Proof Validated', { data })
                        res([data, cid, name, peerIDs, salt, bn])
                    } else if (data.Status === "Proof Invalid") {
                        if (config.mode == 'verbose') console.log('Proof Invalid', { data })
                        rej(data)
                    }
                })
            }
        })
    },
    read: function (key) {
        return new Promise((res, rej) => {
            fetch(`http://localhost:3000/read?key=${key}`)
                .then(r => r.json())
                .then(json => res(json))
                .catch(e => {
                    console.log('Failed to read:', key)
                    rej(e)
                })
        })
    },
    write: function (key, value) {
        return new Promise((res, rej) => {
            fetch(`http://localhost:3000/write?key=${key}&value=${value}`)
                .then(r => r.json())
                .then(json => res(json))
                .catch(e => {
                    console.log('Failed to read:', key)
                    rej(e)
                })
        })
    }

}
exports.PoA = PoA;
