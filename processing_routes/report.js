const config = require('./../config')
const { store } = require("./../index");
const { PoA } = require("./validators");
const { getPathObj, getPathNum, deleteObjs, getPathSome } = require("./../getPathObj");

const { ipfsPeerConnect } = require("./../ipfsSaveState");

exports.report = (json, from, active, pc) => {
    var pReport = getPathObj(['markets', 'node', from])
    var pRand = getPathObj(['rand'])
    var pStats = getPathObj(['stats'])
    let pVal = getPathObj(['val'])
    let PcBroca = getPathObj(['cbroca'])
    Promise.all([pReport, pRand, pStats, pVal, PcBroca]).then(mem => {
        var b = mem[0], rand = mem[1], stats = mem[2], val = mem[3], cBroca = mem[4]
        if (from == b.self && active) {
            b.report = json
            delete b.report.timestamp
            console.log(b.report.v , from)
            if(b.report.v){
                PoA.Check(b, rand, stats, val, cBroca, pc)
            } else {
                var ops = [
                    { type: 'put', path: ['markets', 'node', from], data: b }
                ]
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            }
            if(json.ipfs_id && config.ipfshost == 'ipfs')ipfsPeerConnect(json.ipfs_id)
        } else {
            pc[0](pc[2])
        }
    })
}

