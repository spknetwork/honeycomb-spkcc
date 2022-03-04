const config = require('./../config')
const { store } = require("./../index");
const { getPathNum, getPathObj } = require("./../getPathObj");
const { postToDiscord } = require('./../discord');
const { updatePromote } = require('./../edb');
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
                if(json.to === 'null' && json.memo.split('/')[1]){
                    msg = `@${from}| Promoted @${json.memo} with ${parseFloat(parseInt(json.amount) / 1000).toFixed(3)} ${config.TOKEN}`
                    if(config.dbcs){
                        let author = json.memo.split('/')[0],
                            permlink = json.memo.split('/')[1]
                        if(author.split('@')[1]){
                            author = author.split('@')[1]
                        }
                        updatePromote(author,permlink, send)
                    }
                }
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

exports.claim = (json, from, active, pc) => {
    let fbalp = getPathNum(['cbalances', from]),
        tbp = getPathNum(['balances', from]),
        splitp = getPathNum(['gov', from]),
        totp = getPathNum(['gov', 't']);
    Promise.all([fbalp, tbp, splitp, totp])
        .then(bals => {
            let fbal = bals[0],
                tbal = bals[1],
                split = bals[2],
                tot = bals[3],
                ops = [],
                claim = parseInt(fbal);
            if (claim > 0) {
                const half = parseInt(claim / 2),
                    other = claim - half,
                    msg = `@${from}| Claimed ${parseFloat(parseInt(claim) / 1000).toFixed(3)} ${config.TOKEN} - Half locked in gov`
                ops.push({ type: 'del', path: ['cbalances', from] });
                ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + half) });
                ops.push({ type: 'put', path: ['gov', from], data: parseInt(split + other) });
                ops.push({ type: 'put', path: ['gov', 't'], data: parseInt(tot + other) });
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
        totp = getPathNum(['stats', 'tokenSupply']),
        track = getPathObj(['snap', from])
    Promise.all([tbp, totp, track])
        .then(mem => {
            let tbal = mem[0],
                supply = mem[1],
                trak = mem[2],
                ops = []
            if (trak.t) { //get from memory
                if(trak.l.split('').pop() != parseInt(json.timestamp.split('-')[1], 10).toString(16) && (json.timestamp.split('-')[0] == '2022' || json.timestamp.split('-')[0] == '2023' && parseInt(json.timestamp.split('-')[1]) < 3)){
                    trak.l = parseInt(json.timestamp.split('-')[1], 10).toString(16)
                    trak.t += parseInt(json.timestamp.split('-')[1], 10).toString(16)
                    ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + trak.s) });
                    ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s) });
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
                fetch(`${config.snapcs}/api/snapshot?u=${from}`).then(res => res.json()).then(snap=>{
                    //{"hiveCurrent": 743.805, "hiveSnap": 743.805, "vestCurrent": 3832862.583523, "vestSnap": 3470785.995649, "hivePowerSnap": 1879.34242911609, "Larynx": 2623.14742911609, "snapshotBlock": 60714039, "snapshotTimestamp": "2022-01-07T08:00:00", "username": "disregardfiat"}
                    trak = {
                        s: parseInt(snap.Larynx * 1000 / 12), // Larynx per claim
                        t: parseInt(json.timestamp.split('-')[1], 10).toString(16), // total claims
                        l: parseInt(json.timestamp.split('-')[1], 10).toString(16), // last claim month int
                    }
                    ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + trak.s) });
                    ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s) });
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
                    ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + trak.s) });
                    ops.push({ type: 'put', path: ['stats', 'tokenSupply'], data: parseInt(supply + trak.s) });
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