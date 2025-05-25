import config from './config.js'
import { plasma, VERSION, CodeShare } from './index.js'

//tell the hive your state, this is asynchronous with IPFS return... 
export function report(plas, con, additional = {}) {
    return new Promise((resolve, reject) => {
        con.then(r => {
            var val = []
            if(typeof CodeShare.reportFunction == 'function')CodeShare.reportFunction(val, plas, con, additional).then(r => {
                let report = {
                    hash: plas.hashLastIBlock,
                    block: plas.hashBlock,
                    stash: plas.privHash,
                    ipfs_id: plas.id,
                    version: VERSION
                }
                if (val.length) report.v = val
                if (plas.hashBlock % 10000 == 1) {
                    report.hive_check = plas.hive_offset,
                        report.hbd_check = plas.hbd_offset
                }
                try {
                    if (r.block > report.block) {
                        report.sig = r.sig,
                            report.sig_block = r.block
                    }
                } catch (e) { }
                try {
                    if (plasma.oracle) {
                        report.oracle = plasma.oracle
                    }
                } catch (e) { }

                var op = [
                    "custom_json",
                    {
                        required_auths: [config.username],
                        required_posting_auths: [],
                        id: `${config.prefix}report${config.mirrorNet ? "M" : ""}`,
                        json: JSON.stringify(report),
                    },
                ];
                delete plasma.oracle
                resolve([
                    [0, 0], op
                ])
            })
            else {
                let report = {
                    hash: plas.hashLastIBlock,
                    block: plas.hashBlock,
                    stash: plas.privHash,
                    ipfs_id: plas.id,
                    version: VERSION
                }
                if (plas.hashBlock % 10000 == 1) {
                    report.hive_check = plas.hive_offset,
                        report.hbd_check = plas.hbd_offset
                }
                try {
                    if (r.block > report.block) {
                        report.sig = r.sig,
                            report.sig_block = r.block
                    }
                } catch (e) { }
                try {
                    if (plasma.oracle) {
                        report.oracle = plasma.oracle
                    }
                } catch (e) { }

                var op = [
                    "custom_json",
                    {
                        required_auths: [config.username],
                        required_posting_auths: [],
                        id: `${config.prefix}report${config.mirrorNet ? "M" : ""}`,
                        json: JSON.stringify(report),
                    },
                ];
                delete plasma.oracle
                resolve([
                    [0, 0], op
                ])
            }
        })
    })
}

function msIzer(timer) {
    var ms = 0
    // regex to match m but not ms
    var minuteD = timer.split(/m(?![s])/g)
    if (minuteD.length > 1) {
        var minutes = minuteD[0]
        timer = minuteD[1]
        const dotSplit = minutes.split(".")
        if (dotSplit.length > 1) {
            ms += parseInt(dotSplit[0]) * 60000
            ms = parseInt(dotSplit[1] * 60) * 1000
        } else {
            ms += parseInt(dotSplit[0]) * 60000
        }
    }
    // regex to match s but not ms
    var secondD = timer.split(/(?<![m])s/g)
    if (secondD.length > 1) {
        var seconds = secondD[0]
        timer = secondD[1]
        ms += parseInt(parseFloat(seconds) * 1000)
    }
    // regex to match ms
    var millisecondD = timer.split(/ms/g)
    if (millisecondD.length > 1) {
        ms += parseInt(millisecondD[0])
    }
    return ms
}

export function sig_submit(sign) {
    return new Promise((resolve, reject) => {
        sign.then(r => {
            let report = {
                sig: r.sig,
                sig_block: r.block
            }
            var op = [
                "custom_json",
                {
                    required_auths: [config.username],
                    required_posting_auths: [],
                    id: `${config.prefix}sig_submit${config.mirrorNet ? "M" : ""}`,
                    json: JSON.stringify(report),
                },
            ];
            resolve([
                [0, 0], op
            ])
        })
    })
}

export function osig_submit(sign) {
    return new Promise((resolve, reject) => {
        sign.then(r => {
            let report = {
                sig: r.sig,
                sig_block: r.block
            }
            var op = [
                "custom_json",
                {
                    required_auths: [config.username],
                    required_posting_auths: [],
                    id: `${config.prefix}osig_submit${config.mirrorNet ? "M" : ""}`,
                    json: JSON.stringify(report),
                },
            ];
            resolve([
                [0, 0], op
            ])
        })
    })
}