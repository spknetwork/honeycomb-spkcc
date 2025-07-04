import { config } from './config.js'
import { plasma, VERSION } from './index.mjs'
import { RAM } from './routes/api.js'
import fetch from 'node-fetch'
import { CodeShare } from './hot-loader.js'

//tell the hive your state, this is asynchronous with IPFS return... 
export function report(plas, con, additional = {}) {
    return new Promise((resolve, reject) => {
        con.then(r => {
            const context = { config, fetch }
            let reportFunction = null;
            
            if(CodeShare.reportFunction) {
                if(typeof CodeShare.reportFunction === 'function') {
                    // Already rehydrated as a function
                    reportFunction = CodeShare.reportFunction;
                } else if(typeof CodeShare.reportFunction === 'string') {
                    // JSON string from chain - needs parsing and rehydration
                    try {
                        const rf = JSON.parse(CodeShare.reportFunction);
                        if(rf && rf.body) {
                            // Create function from body string
                            const paramsArray = rf.params ? Object.values(rf.params) : [];
                            reportFunction = new Function(...paramsArray, rf.body);
                        }
                    } catch(e) {
                        console.error('Error parsing reportFunction:', e);
                    }
                } else if(typeof CodeShare.reportFunction === 'object' && CodeShare.reportFunction.body) {
                    // Already parsed object with body property
                    const paramsArray = CodeShare.reportFunction.params ? Object.values(CodeShare.reportFunction.params) : [];
                    reportFunction = new Function(...paramsArray, CodeShare.reportFunction.body);
                }
            }
            
            if(reportFunction) {
                reportFunction(plas, con, RAM.pending, context).then(customReport => {
                    console.log('reportFunction', customReport)
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
                    report = {...report, ...customReport}
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
            } else {
                console.log('Standard report')
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