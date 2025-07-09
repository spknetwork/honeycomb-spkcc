import { Config, store, Owners } from "../index.mjs"
import { getPathObj } from "./../getPathObj.js"
import { verify, isValidTxSig } from "./../tally.js"

export const account_update = (json, pc) => {
    if(json.account == Config("msaccount")) {
        store.batch([{type:'del', path:['stats', 'ms']}], [after, pc[1], 'del'])
        function after() {
            var ops = []
            if(json.active) {
                let account_auths = {}
                for (var i = 0; i < json.active.account_auths.length; i++){
                    account_auths[json.active.account_auths[i][0]] = json.active.account_auths[i][1]
                }
                ops.push({type:'put', path:['stats', 'ms', 'active_account_auths'], data: account_auths})
                if(json.active.weight_threshold) ops.push({type:'put', path:['stats', 'ms', 'active_threshold'], data: json.active.weight_threshold})
            }
            if(json.owner) {
                let owner_key_auths = {}
                for (var i = 0; i < json.owner.key_auths.length;i++){
                    owner_key_auths[json.owner.key_auths[i][0]] = json.owner.key_auths[i][1]
                }
                ops.push({type:'put', path:['stats', 'ms', 'owner_key_auths'], data: owner_key_auths})
                if(json.owner.weight_threshold) ops.push({type:'put', path:['stats', 'ms', 'owner_threshold'], data: json.owner.weight_threshold})
            }
            if(json.posting) {
                let paccount_auths = {}
                for (var i = 0; i < json.posting.account_auths.length;i++){
                    paccount_auths[json.posting.account_auths[i][0]] = json.posting.account_auths[i][1]
                }
                ops.push({type:'put', path:['stats', 'ms', 'active_account_auths'], data: paccount_auths})
                if(json.posting.weight_threshold) ops.push({type:'put', path:['stats', 'ms', 'posting_threshold'], data: json.posting.weight_threshold})
            }
            if(json.memo_key) ops.push({type:'put', path:['stats', 'ms', 'memo_key'], data: json.memo_key})
            ops.push({type:'del', path:['msso']})
            store.batch(ops, pc)
        } 
    } else if (json.active && Owners.is(json.account) && json.active.key_auths[0]?.[0]) {
        Owners.activeUpdate(json.account, json.active.key_auths[0][0]);
        pc[0](pc[2])
    } else {
        pc[0](pc[2])
    }
}

export const sig_submit = (json, from, active, pc) => {
    var Pop = getPathObj(['mss', `${json.sig_block}`]),
        Psigs = getPathObj(['mss', `${json.sig_block}:sigs`]),
        Pstats = getPathObj(['stats']),
        Pnode = getPathObj(['markets', 'nodes', from])
    Promise.all([Pop, Pstats, Psigs, Pnode])
        .then(got => {
            let msop = got[0],
                stats = got[1],
                sigs = got[2],
                node = got[3],
                ops = []
                try{
                    msop = JSON.parse(msop)
                } catch (e){}
            if (active && stats.ms.active_account_auths[from] && msop.expiration) {
                if(Config("mode") == 'verbose')console.log({sigs, from}, msop, json.sig, node.mskey)
                if (node.mskey && isValidTxSig(msop, json.sig, node.mskey)){
                    if (Config("mode") == "verbose") console.log("VERIFIED");
                    // Track verified signatures for bonding curve rewards
                    if (!node.vS) node.vS = 0;
                    node.vS++;
                    ops.push({
                      type: "put",
                      path: ["markets", "nodes", from],
                      data: node
                    });
                    ops.push({
                      type: "put",
                      path: ["mss", `${json.sig_block}:sigs`],
                      data: sigs,
                    });
                    sigs[from] = json.sig;
                    // Calculate weighted signature threshold
                    let weightedSigs = 0;
                    for (var signer in sigs) {
                        weightedSigs += stats.ms.active_account_auths[signer] || 0;
                    }
                    if (weightedSigs >= stats.ms.active_threshold) {
                      let sigarr = [];
                      for (var i in sigs) {
                        sigarr.push(sigs[i]);
                      }
                      verify(msop, sigarr, stats.ms.active_threshold);
                    }
                } else {
                    if (Config("mode") == "verbose") console.log("SIGNATURE VERIFICATION FAILED");
                }
                store.batch(ops, pc);
                //try to sign
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}

export const osig_submit = (json, from, active, pc) => {
    var Pop = getPathObj(['msso', `${json.sig_block}`]),
        Psigs = getPathObj(['msso', `${json.sig_block}:sigs`]),
        Pstats = getPathObj(['stats']),
        Pnode = getPathObj(['markets', 'nodes', from])
    Promise.all([Pop, Pstats, Psigs, Pnode])
        .then(got => {
            let msop = got[0],
                stats = got[1],
                sigs = got[2],
                node = got[3],
                ops = []
                try{
                    msop = JSON.parse(msop)
                } catch (e){}
            if (active && stats.ms.active_account_auths[from] && msop.expiration) {
                if(Config("mode") == 'verbose')console.log({sigs, from}, msop, json.sig, node.mskey)
                if (node.mskey && isValidTxSig(msop, json.sig, node.mskey)){
                    if (Config("mode") == "verbose") console.log("VERIFIED");
                    // Track verified signatures for bonding curve rewards
                    if (!node.vS) node.vS = 0;
                    node.vS++;
                    ops.push({
                      type: "put",
                      path: ["markets", "nodes", from],
                      data: node
                    });
                    sigs[from] = json.sig
                    // For owner operations, we still use simple majority (not weighted)
                    // since owner keys have equal weight
                    if(Object.keys(sigs).length >= stats.ms.owner_threshold){
                        let sigarr = []
                        for(var i in sigs){
                            sigarr.push(sigs[i])
                        }
                        verify(msop, sigarr, stats.ms.owner_threshold)
                    }
                    ops.push({ type: 'put', path: ['msso', `${json.sig_block}:sigs`], data: sigs })
                } else {
                    if (Config("mode") == "verbose") console.log("SIGNATURE VERIFICATION FAILED");
                }
                store.batch(ops, pc);
                //try to sign
            } else {
                pc[0](pc[2])
            }
        })
        .catch(e => { console.log(e); });
}
