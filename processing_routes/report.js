import { store, Config } from "../index.mjs"
import { ipfsPeerConnect } from "../ipfsSaveState.js"

export const report = (json, from, active, pc) => {
    store.get(['markets', 'node', from], function(e, a) {
        if(!json.block_num) console.log(json)
        if (!e) {
            var b = a
            if (from == b.self && active) {
                b.report = json
                delete b.report.timestamp
                var ops = [
                    { type: 'put', path: ['markets', 'node', from], data: b }
                ]
                if(json.ipfs_id && Config("ipfshost") == 'ipfs')ipfsPeerConnect(json.ipfs_id)
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            } else {
                pc[0](pc[2])
            }
        } else {
            pc[0](pc[2])
            console.log(e)
        }
    })
}