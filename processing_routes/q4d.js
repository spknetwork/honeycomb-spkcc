import { store, Config } from "../index.js"

export const q4d = (json, from, active, pc) => {
    store.get(['stats', "ms", "active_account_auths"], (e, a) => {
        if (a[from] && json.text && json.title) {
            store.batch([{
                type: 'put',
                path: ['postQueue', json.title],
                data: {
                    text: json.text,
                    title: json.title
                }
            }], pc)
        } else {
            pc[0](pc[2])
        }
    })
}