import { config } from './config.js'
import { plasma, VERSION, CodeShare } from './index.mjs'
import fetch from 'node-fetch'

//tell the hive your state, this is asynchronous with IPFS return... 
export function report(plas, con, additional = {}) {
    return new Promise((resolve, reject) => {
        con.then(r => {
            var val = []
            const context = { config, fetch }
            if(typeof CodeShare.reportFunction == 'function')CodeShare.reportFunction(val, plas, con, additional, context).then(r => {
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