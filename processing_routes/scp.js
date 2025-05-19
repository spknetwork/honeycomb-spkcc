import { Config, store } from "../index.mjs"
import { getPathNum, getPathObj } from "./../getPathObj.js"
import { postToDiscord } from './../discord.js'
import { chronAssign } from '../lil_ops.js'

// type on, onOperation, api, chron

export const scp_add = (json, from, active, pc) => {
    if(false && active && typeof json.func == 'string' && (json.type == 'on' || json.type == 'onOperation' || json.type == 'api' || json.type == 'chron')){
    let Pscp = getPathObj(['scp', json.transaction_id])
    let Pchain = getPathObj(['chain'])
    let Pstats = getPathObj(['stats'])
    Promise.all([Pscp, Pchain, Pstats])
        .then(mem => {
            let scp = mem[0]
            let chain = mem[1]
            let stats = mem[2]
            let ops = []
        })
    } else {
        pc[0](pc[2])
    }
}

export const scp_del = (json, from, active, pc) => {pc[0](pc[2])}

export const scp_vote = (json, from, active, pc) => {pc[0](pc[2])}