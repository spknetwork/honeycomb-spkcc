const config = require('./../config')
const { store } = require("./../index");
const { getPathNum, getPathObj } = require("./../getPathObj");
const { reward_spk } = require("../lil_ops");
const { postToDiscord } = require('./../discord');
const fetch = require('node-fetch');

exports.send = (json, from, active, pc) => {
    let fbalp = getPathNum(['balances', from]),
        tbp = getPathNum(['balances', json.to]); //to balance promise
    Promise.all([fbalp, tbp])
        .then(bals => {
            let fbal = bals[0],
                tbal = bals[1],
                ops = [];
            send = parseInt(json.amount);
            if (json.to && typeof json.to == 'string' && send > 0 && fbal >= send && active && json.to != from) { //balance checks
                ops.push({ type: 'put', path: ['balances', from], data: parseInt(fbal - send) });
                ops.push({ type: 'put', path: ['balances', json.to], data: parseInt(tbal + send) });
                let msg = `@${from}| Sent @${json.to} ${parseFloat(parseInt(json.amount) / 1000).toFixed(3)} ${config.TOKEN}`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid send operation` });
            }
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
}

exports.spk_send = (json, from, active, pc) => {
    let Pinterest = reward_spk(from, json.block_num),
        Pinterest2 = reward_spk(json.to, json.block_num);
    Promise.all([Pinterest, Pinterest2])
        .then(interest => {
            let fbalp = getPathNum(["spk", from]),
                tbp = getPathNum(["spk", json.to]); //to balance promise
            Promise.all([fbalp, tbp])
                .then((bals) => {
                    let fbal = bals[0],
                        tbal = bals[1],
                        ops = [];
                    send = parseInt(json.amount);
                    if (
                        json.to &&
                        typeof json.to == "string" &&
                        send > 0 &&
                        fbal >= send &&
                        active &&
                        json.to != from
                    ) {
                        //balance checks
                        ops.push({
                            type: "put",
                            path: ["spk", from],
                            data: parseInt(fbal - send),
                        });
                        ops.push({
                            type: "put",
                            path: ["spk", json.to],
                            data: parseInt(tbal + send),
                        });
                        let msg = `@${from}| Sent @${json.to} ${parseFloat(
                            parseInt(json.amount) / 1000
                        ).toFixed(3)} SPK`;
                        if (config.hookurl || config.status)
                            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
                        ops.push({
                            type: "put",
                            path: ["feed", `${json.block_num}:${json.transaction_id}`],
                            data: msg,
                        });
                    } else {
                        ops.push({
                            type: "put",
                            path: ["feed", `${json.block_num}:${json.transaction_id}`],
                            data: `@${from}| Invalid spk send operation`,
                        });
                    }
                    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                    store.batch(ops, pc);
                })
                .catch((e) => {
                    console.log(e);
                });
        })
};

exports.shares_claim = (json, from, active, pc) => {
    let fbalp = getPathNum(['cbalances', from]),
        tbp = getPathNum(['balances', from]),
        Pinterest = reward_spk(from, json.block_num)
    Promise.all([fbalp, tbp, Pinterest])
        .then(bals => {
            let fbal = bals[0],
                tbal = bals[1],
                ops = [],
                claim = parseInt(fbal);
            if (claim > 0) {
                const msg = `@${from}| Shares claimed: ${parseFloat(parseInt(claim) / 1000).toFixed(3)} ${config.TOKEN}`
                ops.push({ type: 'del', path: ['cbalances', from] });
                ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + claim) });
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
            } else {
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid claim operation` });
            }
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
}

exports.drop_claim = (json, from, active, pc) => {
    let tbp = getPathNum(['balances', from]),
        rd = getPathNum(['balances', 'rd']),
        totp = getPathNum(['stats', 'tokenSupply']),
        track = getPathObj(['snap', from]),
        burn = getPathObj(['stats', 'daoclaim'])
    Promise.all([tbp, totp, track, burn, rd])
        .then(mem => {
            let tbal = mem[0],
                supply = mem[1],
                trak = mem[2],
                dao = mem[3],
                rdbal = mem[4],
                ops = [],
                newClaim = 0
            if (dao.m != json.timestamp.split('-')[1] && (json.timestamp.split('-')[0] == '2022' || json.timestamp.split('-')[0] == '2023') && parseInt(json.timestamp.split('-')[1]) < 4) {
                dao.m = json.timestamp.split('-')[1] //set month
                newClaim = parseInt((supply - dao.ct) * (dao.v / 10000))//only distribute based on new supply
                dao[json.timestamp.split('-')[1]] = newClaim //set claim reciept by month
                dao.t += newClaim //add to total
                dao.ct = supply + newClaim //track the current supply so new tokens only get issued off claims
                ops.push({ type: 'put', path: ['balances', 'rd'], data: parseInt(rdbal + newClaim) }); //dao account
                ops.push({ type: 'put', path: ['stats', 'daoclaim'], data: dao }); //this obect
                ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: supply + newClaim }); //update supply
            }
            if (trak.t) { //get from memory
                if (trak.l.split('').pop() != parseInt(json.timestamp.split('-')[1], 10).toString(16) && (json.timestamp.split('-')[0] == '2022' || json.timestamp.split('-')[0] == '2023' && parseInt(json.timestamp.split('-')[1]) < 3)) {
                    trak.l = parseInt(json.timestamp.split('-')[1], 10).toString(16)
                    trak.t += parseInt(json.timestamp.split('-')[1], 10).toString(16)
                    if (!newClaim) ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s) });
                    else {
                        ops.pop()
                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s + newClaim) }); //update supply with new claim
                    }
                    ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + trak.s) });
                    ops.push({ type: 'put', path: ['snap', from], data: trak });
                    let msg = `@${from}| Claimed ${parseFloat(parseInt(trak.s) / 1000).toFixed(3)} ${config.TOKEN}`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                } else {
                    let msg = `@${from}| Already claimed this month.`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                }
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc);
            } else { //get from claims
                fetch(`${config.snapcs}/api/snapshot?u=${from}`).then(res => res.json()).then(snap => {
                    //{"hiveCurrent": 743.805, "hiveSnap": 743.805, "vestCurrent": 3832862.583523, "vestSnap": 3470785.995649, "hivePowerSnap": 1879.34242911609, "Larynx": 2623.14742911609, "snapshotBlock": 60714039, "snapshotTimestamp": "2022-01-07T08:00:00", "username": "disregardfiat"}
                    trak = {
                        s: parseInt(snap.Larynx * 1000 / 12), // Larynx per claim
                        t: parseInt(json.timestamp.split('-')[1], 10).toString(16), // total claims
                        l: parseInt(json.timestamp.split('-')[1], 10).toString(16), // last claim month int
                    }
                    if (!newClaim) ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s) });
                    else {
                        ops.pop()
                        ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s + newClaim) }); //update supply with new claim
                    }
                    ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + trak.s) });
                    ops.push({ type: 'put', path: ['snap', from], data: trak });
                    let msg = `@${from}| Claimed ${parseFloat(parseInt(trak.s) / 1000).toFixed(3)} ${config.TOKEN}`
                    if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                    store.batch(ops, pc);
                })
                    .catch(e => {
                        trak = {
                            s: 0, // Larynx per claim
                            t: parseInt(json.timestamp.split('-')[1], 10).toString(16), // total claims
                            l: parseInt(json.timestamp.split('-')[1], 10).toString(16), // last claim month int
                        }
                        if (!newClaim) ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s) });
                        else {
                            ops.pop()
                            ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s + newClaim) }); //update supply with new claim
                        }
                        ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + trak.s) });
                        ops.push({ type: 'put', path: ['snap', from], data: trak });
                        let msg = `@${from}| Claimed ${parseFloat(parseInt(trak.s) / 1000).toFixed(3)} ${config.TOKEN}`
                        if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                        ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
                        store.batch(ops, pc);
                    });
            }
        })
        .catch(e => { console.log(e); });
}

/*

const half = parseInt(claim / 2),
                    other = claim - half,
                    msg = `@${from}| Claimed ${parseFloat(parseInt(claim) / 1000).toFixed(3)} ${config.TOKEN} - Half locked in gov`
                ops.push({ type: 'del', path: ['cbalances', from] });
                ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + half) });
                ops.push({ type: 'put', path: ['gov', from], data: parseInt(split + other) });
                ops.push({ type: 'put', path: ['gov', 't'], data: parseInt(tot + other) });
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });

                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid claim operation` });

                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc);
*/