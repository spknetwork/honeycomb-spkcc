import { store } from "../index.js"
import { getPathObj } from "./../getPathObj.js"
import { chronAssign } from '../lil_ops.js'

export const scp_add = (json, from, active, pc) => {
    //json type 1-4 onOperation, on, api, chron
    if (active && typeof json.func == 'string' && typeof json.path == 'string' && json.type >= 1 && json.type <= 4) {
        let Pchain = getPathObj(['chain'])
        let Pstats = getPathObj(['stats'])
        Promise.all([Pchain, Pstats])
            .then(mem => {
                let chain = mem[0],
                    stats = mem[1],
                    ops = [],
                    proposal = {}
                switch (json.type) {
                    case 1:
                        proposal.type = 'onOperation'
                        break
                    case 2:
                        proposal.type = 'on'
                        break
                    case 3:
                        proposal.type = 'api'
                        break
                    case 4:
                        proposal.type = 'chron'
                        break
                    default:
                        pc[0](pc[2])
                        return
                }
                proposal.id = json.transaction_id
                proposal.path = json.path
                proposal.func = json.func
                proposal.from = from
                proposal.approvals = {}
                proposal.threshold = stats.ms.active_threshold
                const accounts = stats.ms.active_account_auths
                for (let i = 0; i < accounts.length; i++) {
                    proposal.approvals[accounts[i]] = 0
                }
                chronAssign(parseInt(json.block_num + 201600), {
                    block: parseInt(json.block_num + 201600),
                    op: 'sc_end',
                    id: json.transaction_id,
                }).then(x => {
                    proposal.chron = x
                    ops.push({
                        type: 'put',
                        path: ['scp', json.transaction_id],
                        data: proposal
                    })
                    ops.push({
                        type: 'put',
                        path: ['feed', `${json.block_num}:${json.transaction_id}`],
                        data: `@${from}| Proposed ${json.func}`
                    })
                    store.batch(ops, pc)
                })
            })
    } else {
        pc[0](pc[2])
    }
}

export const scp_del = (json, from, active, pc) => {
    if (active && typeof json.id == 'string') {
        let Pscp = getPathObj(['scp', json.id])
        Promise.all([Pscp])
            .then(mem => {
                let proposal = mem[0],
                    ops = []
                if (proposal.from == from) {
                    ops.push({
                        type: 'del',
                        path: ['scp', json.id]
                    })
                    ops.push({
                        type: 'del',
                        path: ['chrono', proposal.chron]
                    })
                    ops.push({
                        type: 'put',
                        path: ['feed', `${json.block_num}:${json.transaction_id}`],
                        data: `@${from}| Deleted SCP ${json.id}`
                    })
                    store.batch(ops, pc)
                } else {
                    pc[0](pc[2])
                }
            })
    } else {
        pc[0](pc[2])
    }
}

export const scp_vote = (json, from, active, pc) => {
    if (active && typeof json.id == 'string' && typeof json.approve == 'boolean') {
        let Pscp = getPathObj(['scp', json.id])
        Promise.all([Pscp])
            .then(mem => {
                let proposal = mem[0],
                    ops = []
                if (proposal.approvals[from] > -2 && proposal.approvals[from] < 2) {
                    proposal.approvals[from] = json.approve ? 1 : -1
                    //check if proposal is approved
                    let approved = 0
                    for (let app in proposal.approvals) {
                        if (proposal.approvals[app] === 1) {
                            approved++
                        }
                    }
                    if (approved >= proposal.threshold) {
                        chronAssign(parseInt(json.block_num + 1), {
                            block: parseInt(json.block_num + 1),
                            op: 'sc_end',
                            id: json.id,
                        }).then(x => {
                            const oldChron = proposal.chron
                            ops.push({ type: 'del', path: ['chrono', oldChron] })
                            proposal.chron = x
                            ops.push({
                                type: 'put',
                                path: ['scp', json.id],
                                data: proposal
                            })
                            ops.push({
                                type: 'put',
                                path: ['feed', `${json.block_num}:${json.transaction_id}`],
                                data: `@${from}| Approved SCP ${json.id}`
                            })
                            store.batch(ops, pc)
                        })
                    } else {
                        ops.push({
                            type: 'put',
                            path: ['scp', json.id],
                            data: proposal
                        })
                        ops.push({
                            type: 'put',
                            path: ['feed', `${json.block_num}:${json.transaction_id}`],
                            data: `@${from}| Voted ${json.approve ? 'Approve' : 'Reject'} SCP ${json.id}`
                        })
                        store.batch(ops, pc)
                    }
                }
            })
    } else {
        pc[0](pc[2])
    }
}