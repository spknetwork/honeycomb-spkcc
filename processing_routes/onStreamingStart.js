import { Config, store, unshiftOp, TXID } from "../index.mjs"
import hivejs from '@hiveio/hive-js'

export const onStreamingStart = () => {
    console.log("At real time.");
    TXID.current()
    store.get(['markets', 'node', Config("username")], function(e, a) {
        if ((!a.domain && Config("NODEDOMAIN")) || (a.domain != Config("NODEDOMAIN"))) {
            var mskey, mschallenge
            if(Config("msowner") && Config("mspublic")){
                mskey = Config("mspublic")
                mschallenge = hivejs.encode(Config("msowner"), Config("msPubMemo"), `#${Config("mspublic")}`)
            }
            var op = ["custom_json", {
                required_auths: [Config("username")],
                required_posting_auths: [],
                id: `${Config("prefix")}node_add`,
                json: JSON.stringify({
                    domain: Config("NODEDOMAIN"),
                    bidRate: Config("bidRate"),
                    mskey,
                    mschallenge,
                    escrow: true
                })
            }];
            unshiftOp([
                [0, 0], op
            ]);
            return op
        }
    });
}
