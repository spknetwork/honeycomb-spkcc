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
            console.log('CodeShare', CodeShare)
            if(CodeShare.reportFunction && CodeShare.reportFunction.body) {
                // Rehydrate the function from the body string
                const functionBody = CodeShare.reportFunction.body;
                // The body starts with "}, context = {}) {" so we need to prepend the proper parameters
                const fullFunctionBody = `(plas, con, additional, proofs, context = {}) {
                    return new Promise((resolve, reject) => {
                        var val = []
                        const offset = plas.hashBlock % 200 > 100 ? 0 : 100
                        for (var i = 0; i < 100; i++) {
                            for (var CID in proofs[\`\${i + offset}\`]) {
                                var formated = [CID, \`\${i + offset}\`]
                                var nodes
                                try {
                                    nodes = Object.keys(proofs[\`\${i + offset}\`][CID].npid)
                                } catch (e) { continue }
                                if (nodes.length) {
                                    for (var j = 0; j < nodes.length; j++) {
                                        // Just read the 1-3 char string from RAM
                                        const scoreStr = proofs[\`\${i + offset}\`][CID].npid[nodes[j]]
                                        if (scoreStr && typeof scoreStr === 'string' && scoreStr.length >= 1) {
                                            formated.push([nodes[j], scoreStr])
                                        }
                                        // If no score string, node failed validation - don't include
                                    }
                                    if (formated.length > 2) val.push(formated)
                                }
                            }
                            if (JSON.stringify(val).length > 7800) break
                        }
                        resolve({v:val})
                    })
                }`;
                const reportFunction = new Function('return ' + fullFunctionBody)();
                
                reportFunction(plas, con, additional, RAM.pending, context ).then(r => {
                    console.log('reportFunction', r)
                    val = r
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
                    report = {...report, ...r}
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