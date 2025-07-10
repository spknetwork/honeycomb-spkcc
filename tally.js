import { getPathObj, getPathNum, deleteObjs } from "./getPathObj.js"
import { Config, store, hiveClient, plasma, Owners } from "./index.mjs"
import { updatePost } from "./edb.js"
import hiveTx from "hive-tx"
import { sha256 } from "hive-tx/helpers/crypto.js"
import {
    //add, addCol, addGov, deletePointer, credit, chronAssign, hashThis, isEmpty,
    addMT,
} from "./lil_ops.js"
import stringify from "json-stable-stringify"
import { CodeShare } from "./hot-loader.js"

//determine consensus... needs some work with memory management
export const tally = (num, plasma, isStreaming, runtimeContext) => {
    return new Promise((resolve, reject) => {
        var Prunners = getPathObj(["runners"]),
            Pnode = getPathObj(["markets", "node"]),
            Pstats = getPathObj(["stats"]),
            Prb = getPathObj(["balances"]),
            Prcol = getPathObj(["col"]),
            Prpow = getPathObj([Config("govToken")]),
            Prqueue = getPathObj(["queue"]),
            Ppending = getPathObj(["pendingpayment"]),
            Pmss = getPathObj(["mss"]),
            PhiveTick = getPathNum(["dex", "hive", "tick"]),
            PhbdTick = getPathNum(["dex", "hbd", "tick"]),
            PhivePool = getPathObj(["dex", "hive", "pool"]),
            PhbdPool = getPathObj(["dex", "hbd", "pool"]);
        Promise.all([
            Prunners,
            Pnode,
            Pstats,
            Prb,
            Prcol,
            Prpow,
            Prqueue,
            Ppending,
            Pmss,
            PhiveTick,
            PhbdTick,
            PhivePool,
            PhbdPool
        ]).then(function (v) {
            deleteObjs([["runners"], ["queue"], ["pendingpayment"]])
                .then((empty) => {
                    var runners = v[0],
                        nodes = v[1],
                        stats = v[2],
                        rbal = v[3],
                        rcol = v[4],
                        rgov = v[5],
                        pending = v[7],
                        mssp = v[8],
                        ms = v[9],
                        hiveTick = v[10],
                        hbdTick = v[11],
                        hivePool = v[12],
                        hbdPool = v[13],
                        signatures = [],
                        tally = {
                            agreements: {
                                hashes: {},
                                runners: {},
                                tally: {},
                                votes: 0,
                            },
                        },
                        consensus = undefined,
                        mss = {},
                        mssb = 0,
                        oracleArr = [];
                    for (var block in mssp) {
                        if (block == num - 50) {
                            mss = JSON.parse(mssp[block]);
                            mssb = block;
                        }
                    }
                    for (var node in nodes) {
                        var hash = "",
                            when = 0;
                        try {
                            if (
                                stats.ms.active_account_auths[node] &&
                                nodes[node].report.sig &&
                                nodes[node].report.sig_block == mssb
                            ) {
                                signatures.push(nodes[node].report.sig);
                            }
                        } catch (e) { }
                        try {
                            hash = nodes[node].report.hash;
                        } catch (e) { }
                        try {
                            if (nodes[node].report.oracle)
                                oracleArr.push(nodes[node].report.oracle);
                        } catch (e) { }
                        try {
                            hash = nodes[node].report.hash;
                        } catch (e) { }
                        try {
                            when = nodes[node].report.block_num;
                        } catch (e) { }
                        if (when > num - 50 && hash) {
                            tally.agreements.hashes[node] = hash;
                            tally.agreements.tally[hash] = 0;
                        } //recent and signing
                    }
                    var promises = []; //[oracle(oracleArr, num)]
                    if (runners[Config("username")] && mss.expiration)
                        verify(mss, signatures, stats.ms.active_threshold);
                    // Calculate weighted votes based on collateral
                    let weightedTally = {};
                    let totalWeight = 0;
                    
                    for (var runner in runners) {
                        tally.agreements.votes++;
                        if (tally.agreements.hashes[runner] && runners[runner].g) {
                            let weight = runners[runner].g; // Use actual collateral as weight
                            totalWeight += weight;
                            
                            if (!weightedTally[tally.agreements.hashes[runner]]) {
                                weightedTally[tally.agreements.hashes[runner]] = 0;
                            }
                            weightedTally[tally.agreements.hashes[runner]] += weight;
                            
                            // Still track simple count for backwards compatibility
                            tally.agreements.tally[tally.agreements.hashes[runner]]++;
                        }
                    }
                    
                    // Find consensus based on weighted majority
                    let thresholdWeight = totalWeight / 2;
                    let altThresholdWeight = totalWeight - 
                        (stats.chaos > totalWeight / 3 ? parseInt((stats.chaos * totalWeight) / tally.agreements.votes) : parseInt(totalWeight / 3));
                    
                    for (var hash in weightedTally) {
                        if (weightedTally[hash] > thresholdWeight) {
                            consensus = hash;
                            break;
                        }
                    }
                    
                    // Verify multisig owners support consensus (using weighted check)
                    var ownersWeight = 0;
                    for (var owner in stats.ms.active_account_auths) {
                        if (nodes[owner] && nodes[owner].report && nodes[owner].report.hash == consensus) {
                            ownersWeight += stats.ms.active_account_auths[owner];
                        }
                    }
                    if (ownersWeight < stats.ms.active_threshold) consensus = undefined; //ensure owners are part of consensus branch
                    if (!consensus && stats.chaos) {
                        //lower consensus threshold to owners in case of non-agreement
                        for (var hash in weightedTally) {
                            if (weightedTally[hash] > altThresholdWeight / 2) {
                                var ownersWeight = 0;
                                for (var owner in stats.ms.active_account_auths) {
                                    if (nodes[owner]?.report?.hash == hash) {
                                        ownersWeight += stats.ms.active_account_auths[owner];
                                    }
                                }
                                if (ownersWeight >= stats.ms.active_threshold) {
                                    consensus = hash;
                                    break;
                                }
                            }
                        }
                    }
                    let still_running = {},
                        election = {},
                        new_queue = {};
                    console.log("Consensus: " + consensus);
                    if (consensus) {
                        stats.chaos = 0;
                        stats.hashLastIBlock = consensus;
                        stats.lastIBlock = num - 100;
                        let counting_array = [];
                        for (var node in tally.agreements.hashes) {
                            if (tally.agreements.hashes[node] == consensus) {
                                new_queue[node] = {
                                    g: rgov[node] || 0,
                                    api: nodes[node].domain,
                                    l: nodes[node].liquidity || 100,
                                };
                                counting_array.push(new_queue[node].g);
                            }
                        }
                        for (var node in new_queue) {
                            if (runners.hasOwnProperty(node)) {
                                still_running[node] = new_queue[node];
                            } else {
                                election[node] = new_queue[node];
                            }
                        }
                        // With weighted multisig, we can be more inclusive
                        // Set a reasonable minimum threshold for runner participation
                        // The pick() function in dao.js will handle quality control
                        stats.gov_threshhold = 100000; // 100 tokens minimum to be a runner
                        
                        // Count nodes meeting minimum threshold
                        let qualifiedNodes = 0;
                        for (var i = 0; i < counting_array.length; i++) {
                            if (counting_array[i] >= stats.gov_threshhold) {
                                qualifiedNodes++;
                            }
                        }
                        if (Object.keys(still_running).length < 40) {
                            let winner = {
                                node: "",
                                g: 0,
                                api: "",
                            };
                            for (var node in election) {
                                if (election[node].g > winner.g && election[node].g >= stats.gov_threshhold) {
                                    // Must meet minimum threshold
                                    winner.node = node;
                                    winner.g = election[node].g;
                                    winner.api = election[node].domain;
                                }
                            }
                            
                            if (winner.node) {
                                // Add the winner to runners
                                still_running[winner.node] = new_queue[winner.node];
                            } else if (Object.keys(still_running).length < 9) {
                                // Emergency: if we have less than 9 runners, lower standards
                                for (var node in election) {
                                    if (election[node].g >= 10000) { // 10 tokens emergency minimum
                                        still_running[node] = new_queue[node];
                                        break;
                                    }
                                }
                            }
                        }
                        let collateral = [];
                        let liq_rewards = [];
                        let minCollateral = Number.MAX_SAFE_INTEGER;
                        for (var node in still_running) {
                            collateral.push(still_running[node].g);
                            liq_rewards.push(still_running[node].l || 100);
                            if (still_running[node].g < minCollateral) {
                                minCollateral = still_running[node].g;
                            }
                        }
                        let liq_rewards_sum = 0;
                        for (var i = 0; i < liq_rewards.length; i++) {
                            liq_rewards_sum += liq_rewards[i];
                        }
                        stats.liq_reward = liq_rewards_sum / liq_rewards.length;
                        let MultiSigCollateral = 0;
                        collateral.sort((a, b) => b - a);
                        
                        // Calculate total collateral
                        for (var i = 0; i < collateral.length; i++) {
                            MultiSigCollateral += collateral[i];
                        }
                        
                        // Safety limit = active threshold * minimum collateral
                        // This represents the maximum that can be spent by reaching threshold
                        stats.safetyLimit = stats.ms.active_threshold * minCollateral;
                        
                        // Ensure minimum safety limit
                        if (stats.safetyLimit < 1000) stats.safetyLimit = 1000;
                        
                        stats.multiSigCollateral = MultiSigCollateral;

                        // Calculate safetyLimitHBD - safety limit in HBD value
                        const hiveTickPrice = parseFloat(hiveTick || 0.1); // TOKEN/HIVE price
                        const hbdTickPrice = parseFloat(hbdTick || 0.1); // TOKEN/HBD price

                        if (hbdTickPrice > 0) {
                            // Direct conversion using TOKEN/HBD price
                            stats.safetyLimitHBD = Math.floor(stats.safetyLimit * hbdTickPrice);
                        } else if (hiveTickPrice > 0 && stats.priceFeed && stats.priceFeed.hivePrice) {
                            // Convert via HIVE price if HBD tick not available
                            const hivePrice = parseFloat(stats.priceFeed.hivePrice || 0.217);
                            const tokenPriceInHBD = hiveTickPrice * hivePrice;
                            stats.safetyLimitHBD = Math.floor(stats.safetyLimit * tokenPriceInHBD);
                        } else {
                            // Fallback if no price data available
                            stats.safetyLimitHBD = stats.safetyLimit; // 1:1 fallback
                        }

                        // Store pool data in stats for lightweight access
                        stats.pools = {
                            hive: hivePool || { token: 0, hive: 0 },
                            hbd: hbdPool || { token: 0, hbd: 0 }
                        };

                        // Calculate arbitrage opportunity between HIVE and HBD markets
                        if (hiveTickPrice > 0 && hbdTickPrice > 0 && stats.priceFeed && stats.priceFeed.hivePerHbd) {
                            const hivePerHbd = parseFloat(stats.priceFeed.hivePerHbd || 4.608);
                            // Expected HBD tick based on HIVE tick and HIVE/HBD rate
                            const expectedHbdTick = hiveTickPrice * hivePerHbd;
                            // Arbitrage percentage: positive means HBD market is overpriced
                            stats.dexArbitrage = ((hbdTickPrice - expectedHbdTick) / expectedHbdTick * 100).toFixed(2);
                        }

                        // Calculate value balance metric - ratio of HIVE to HBD value in pools
                        if (stats.pools && stats.priceFeed && stats.priceFeed.hivePerHbd) {
                            const hivePerHbd = parseFloat(stats.priceFeed.hivePerHbd || 4.608);
                            const hivePoolValueInHbd = (stats.pools.hive.hive || 0) / hivePerHbd + (stats.pools.hive.token || 0) * hbdTickPrice;
                            const hbdPoolValue = (stats.pools.hbd.hbd || 0) + (stats.pools.hbd.token || 0) * hbdTickPrice;

                            if (hbdPoolValue > 0) {
                                // Value balance: 1.0 means equal value, >1 means more value in HIVE pool
                                stats.dexValueBalance = (hivePoolValueInHbd / hbdPoolValue).toFixed(3);
                            }
                        }

                        stats.hashLastIBlock = stats.lastBlock;
                        stats.lastBlock = consensus;
                        for (var node in nodes) {
                            var getHash,
                                getNum = 0;
                            try {
                                getNum = nodes[node].report.block_num;
                            } catch (e) { }
                            if (getNum > num - 50) {
                                nodes[node].attempts++;
                            }
                            try {
                                getHash = nodes[node].report.hash;
                            } catch (e) { }
                            if (getHash == stats.lastBlock) {
                                nodes[node].yays++;
                                nodes[node].CCR = (nodes[node].CCR || 0 ) + 1
                                nodes[node].lastGood = num;
                            }
                        }
                        for (var node in still_running) {
                            nodes[node].wins++;
                            nodes[node].CCR++
                            if(stats.ms.active_account_auths[node]) nodes[node].CCR++
                        }
                    } else {
                        stats.chaos++;
                        new_queue = v[6];
                        still_running = runners;
                    }
                    let newPlasma = plasma;
                    newPlasma.rep = still_running[Config("username")]?.g ? true : false;
                    (plasma.consensus = consensus || 0), (plasma.new_queue = new_queue);
                    plasma.still_running = still_running;
                    plasma.stats = stats;
                    if (!consensus) {
                        newPlasma.potential = tally;
                    }
                    let this_payout;
                    if (Config("features").pob) {
                        let weights = 0;
                        for (var post in pending) {
                            weights += pending[post].t.totalWeight;
                        }
                        let inflation_floor =
                            parseInt((stats.movingWeight.running + weights / 140) / 2016) + 1; //minimum payout in time period
                        var running_weight = parseInt(stats.movingWeight.running / 2016);
                        if (running_weight < inflation_floor) {
                            running_weight = inflation_floor;
                        }
                        if (num < 50700000) {
                            stats.movingWeight.dailyPool = 700000;
                        }
                        let this_weight = parseInt(weights / 2016);
                        this_payout = parseInt(
                            ((rbal.rc / 200 + stats.movingWeight.dailyPool) / 304) *
                            (this_weight / running_weight)
                        ); //subtract this from the rc account... 13300 is 70% of inflation
                        console.log(stats.movingWeight)
                        stats.movingWeight.running = parseInt(
                            (stats.movingWeight.running * 2015) / 2016 + weights / 2016
                        ); //7 day average at 5 minute intervals
                        promises.unshift(payout(this_payout, weights, pending, num));
                    }
                    Promise.all(promises).then((change) => {
                        const mint = Config("features").inflation
                            ? parseInt(stats.tokenSupply / stats.interestRate)
                            : 0;
                        stats.tokenSupply += mint;
                        rbal.ra += mint;
                        let ops = [
                            { type: "put", path: ["stats"], data: stats },
                            { type: "put", path: ["markets", "node"], data: nodes },
                            { type: "put", path: ["balances", "ra"], data: rbal.ra },
                        ];
                        if (Config("features").pob)
                            ops.push({
                                type: "put",
                                path: ["balances", "rc"],
                                data: rbal.rc - (this_payout - change[0]),
                            });
                        var legal = 0;
                        for (var node in stats.ms.active_account_auths) {
                            if (Object.keys(still_running).includes(node)) legal++;
                        }
                        if (Object.keys(still_running).length && legal)
                            ops.push({ type: "put", path: ["runners"], data: still_running });
                        else if (Object.keys(runners).length)
                            ops.push({ type: "put", path: ["runners"], data: runners });
                        else
                            ops.push({
                                type: "put",
                                path: ["runners"],
                                data: stats.ms.active_account_auths,
                            });
                        if (Object.keys(new_queue).length)
                            ops.push({ type: "put", path: ["queue"], data: new_queue });

                        // Custom tally processing
                        const context = runtimeContext
                        let tallyFunction = null;

                        if (CodeShare.tallyFunction) {
                            if (typeof CodeShare.tallyFunction === 'function') {
                                // Already rehydrated as a function
                                tallyFunction = CodeShare.tallyFunction;
                            } else if (typeof CodeShare.tallyFunction === 'string') {
                                // JSON string from chain - needs parsing and rehydration
                                try {
                                    const tf = JSON.parse(CodeShare.tallyFunction);
                                    if (tf && tf.body) {
                                        // Create function from body string
                                        const paramsArray = tf.params ? Object.values(tf.params) : [];
                                        tallyFunction = new Function(...paramsArray, tf.body);
                                    }
                                } catch (e) {
                                    console.error('Error parsing tallyFunction:', e);
                                }
                            } else if (typeof CodeShare.tallyFunction === 'object' && CodeShare.tallyFunction.body) {
                                const paramsArray = CodeShare.tallyFunction.params ? Object.values(CodeShare.tallyFunction.params) : [];
                                tallyFunction = new Function(...paramsArray, CodeShare.tallyFunction.body);
                            }
                        }

                        if (tallyFunction) {
                            tallyFunction(num, stats, context).then(customTallyResult => {
                                if (customTallyResult && customTallyResult.ops) {
                                    ops = ops.concat(customTallyResult.ops);
                                }
                                store.batch(ops, [resolve, reject, newPlasma]);
                            }).catch(e => {
                                console.error('Error in custom tallyFunction:', e);
                                store.batch(ops, [resolve, reject, newPlasma]);
                            });
                        } else {
                            store.batch(ops, [resolve, reject, newPlasma]);
                        }
                        if (process.env.npm_lifecycle_event != "test") {
                            if (
                                consensus &&
                                (consensus != plasma.hashLastIBlock ||
                                    (consensus != nodes[Config("username")]?.report?.hash &&
                                        nodes[Config("username")]?.report?.block_num > num - 100)) &&
                                isStreaming
                            ) {
                                console.log("Abandoning:", plasma.hashLastIBlock, consensus)
                                process.exit(2);
                                //var errors = ['failed Consensus'];
                                //const blockState = Buffer.from(JSON.stringify([num, state]))
                                //plasma.hashBlock = '';
                                //plasma.hashLastIBlock = '';
                                console.log(
                                    num +
                                    `:Abandoning ${plasma.hashLastIBlock} because failed consensus.`
                                );
                                process.exit(417)
                            }
                        }
                    });
                })
                .catch((e) => {
                    console.log(e);
                });
        });
    });
};

function oracle(oracleArr, num) {
    console.log(oracleArr[0]);
    return new Promise((resolve, reject) => {
        var promises = [getPathObj(["pcon"]), getPathObj(["lth"])];
        Promise.all(promises).then((mem) => {
            let results = {},
                pcon = mem[0],
                lth = mem[1],
                del = [],
                ops = [];
            for (var i = 0; i < oracleArr.length; i++) {
                for (var item in oracleArr[i]) {
                    try {
                        if (oracleArr[i][item].split(":")[0] == "lth") {
                            results[item] = results[item] || 0;
                            results[item] +=
                                oracleArr[i][item].split(":")[1] == "true" ? 1 : -1;
                        }
                    } catch (e) { }
                }
            }
            for (var item in results) {
                let addr = `${item.split(":")[0]}:${item.split(":")[1]}`,
                    listing = lth[addr],
                    setname = item.split(":")[0],
                    from = item.split(":")[2],
                    qty = 0;
                try {
                    qty = parseInt(pcon.lth[addr][from]);
                } catch (e) { }
                if (results[item] > 0) {
                    var transfers = [
                        ...buildSplitTransfers(
                            qty * listing.h + qty * listing.b,
                            listing.h ? "HIVE" : "HBD",
                            listing.d,
                            `${setname} mint token sale - ${from}:vop:${num}`
                        ),
                    ];
                    addMT(["rnfts", setname, from], parseInt(qty));
                    for (var i = 0; i < transfers.length; i++) {
                        ops.push({
                            type: "put",
                            path: ["msa", `${item}:${i}:${num}`],
                            data: stringify(transfers[i]),
                        });
                    }
                    ops.push({ type: "del", path: ["pcon", "lth", addr, from] });
                    del.push(item);
                    try {
                        delete plasma.oracle[`${addr}:${from}`];
                    } catch (e) { }
                } else if (results[item] < 0) {
                    addMT(["lth", addr, "q"], parseInt(qty));
                    ops.push({
                        type: "put",
                        path: ["msa", `${item}:${num}`],
                        data: stringify([
                            "transfer",
                            {
                                from: Config("msaccount"),
                                to: from,
                                amount: `${parseFloat(
                                    (qty * listing.h + qty * listing.b) / 1000
                                ).toFixed(3)} ${listing.h ? "HIVE" : "HBD"}`,
                                memo: `Refund: ${from} is not authorized to buy this NFT`,
                            },
                        ]),
                    });
                    ops.push({ type: "del", path: ["pcon", "lth", addr, from] });
                    del.push(item);
                    try {
                        delete plasma.oracle[`${addr}:${from}`];
                    } catch (e) { }
                }
                cleanOracle(del);
            }
            console.log(ops);
            store.batch(ops, [resolve, reject, "PCON"]);
        });
    });
}
function cleanOracle(oracleArr) {
    return new Promise((resolve, reject) => {
        let ops = [],
            pn = getPathObj(["markets", "node"]);
        Promise.all([pn]).then((mem) => {
            let nodes = mem[0];
            for (var node in nodes) {
                for (var i = 0; i < oracleArr.length; i++) {
                    ops.push({
                        type: "del",
                        path: ["markets", "node", node, "report", "oracle", oracleArr[i]],
                    });
                }
            }
            store.batch(ops, [resolve, reject, "DEL"]);
        });
    });
}

function payout(this_payout, weights, pending, num) {
    return new Promise((resolve, reject) => {
        let payments = {},
            out = 0;
        for (var post in pending) {
            payments[post.split("/")[0]] = 0;
            for (var voter in pending[post].votes) {
                payments[voter] = 0;
            }
        }
        for (var post in pending) {
            if (pending[post].t.totalWeight > 0) {
                const TotalPostPayout = parseInt(
                    (this_payout * pending[post].t.totalWeight) / weights
                );
                pending[post].paid = TotalPostPayout;
                pending[post].author_payout = parseInt(TotalPostPayout / 2);
                payments[post.split("/")[0]] += parseInt(TotalPostPayout / 2); //author reward
                out += parseInt(TotalPostPayout / 2);
                for (var voter in pending[post].votes) {
                    if (pending[post].votes[voter].v > 0) {
                        const this_vote = parseInt(
                            (TotalPostPayout * pending[post].votes[voter].w) /
                            (pending[post].t.linearWeight * 2)
                        );
                        pending[post].votes[voter].p = this_vote;
                        payments[voter] += this_vote;
                        out += this_vote;
                    }
                }
            }
        }
        let promises = [];
        for (var account in payments) {
            promises.push(getPathNum(["balances", account]));
        }
        Promise.all(promises).then((p) => {
            if (p.length) {
                let i = 0,
                    ops = [
                        { type: "put", path: ["paid", num.toString()], data: pending },
                    ];
                if (Config("dbcs")) {
                    for (var j in pending) {
                        updatePost(pending[j]);
                    }
                }
                for (var account in payments) {
                    ops.push({
                        type: "put",
                        path: ["balances", account],
                        data: p[i] + payments[account],
                    });
                    i++;
                }
                let change = this_payout - out;
                if (process.env.npm_lifecycle_event == 'test') {
                    console.log(ops)
                }
                store.batch(ops, [resolve, reject, change]); //return the paid ammount so millitokens aren't lost
            } else {
                resolve(this_payout);
            }
        });
    });
}

export function isValidSig(trx, sig, key) {
    const publicKey = hiveTx.PublicKey.from(key);
    const message = sha256(trx);
    return publicKey.verify(message, hiveTx.Signature.from(sig));
}

export function isValidTxSig(trx, sig, key) {
    const publicKey = hiveTx.PublicKey.from(key);
    const tx = new hiveTx.Transaction(trx);
    const message = tx.digest().digest
    const valid = publicKey.verify(message, hiveTx.Signature.from(sig));
    if (Config("mode") == 'verbose') console.log({ trx, key, valid })
    return valid
}

export function verify(trx, sig, at) {
    return new Promise((resolve, reject) => {
        sendit(trx, sig, at);

        function sendit(tx, sg, t, f) {
            if (Config("mode") == 'verbose') console.log(sg)
            if (sg.length >= t || !f) {
                tx.signatures = sg
                if (tx.signatures.length == t && tx.operations.length) {
                    console.log('Attempting MS Broadcast...')
                    hiveClient.api.broadcastTransactionSynchronous(
                        tx,
                        function (err, result) {
                            if (err && err.data.code == 4030100) {
                                console.log("EXPIRED");
                                resolve("EXPIRED");
                            } else if (err && err.data.code == 3010000) {
                                //missing authority
                                console.log("MISSING");
                            } else if (err && err.data.code == 10) {
                                //duplicate transaction
                                console.log("SENT:Signer");
                                resolve("SENT");
                            } else {
                                if (result) {
                                    console.log('SENT:broadcaster')
                                    resolve("SENT");
                                } else {
                                    console.log(err);
                                }
                            }
                        }
                    );
                } else {
                    if (Config("mode") == 'verbose') {
                        console.log(tx)
                    }
                }
            } else {
                resolve("FAIL");
                console.log("FAIL");
            }
        }
    });
}

function buildSplitTransfers(amount, pair, ds, memos) {
    console.log({ amount, pair, ds, memos });
    let tos = ds.split(",") || 0;
    if (!tos) return [];
    let ops = [],
        total = 0;
    for (var i = tos.length - 1; i >= 0; i--) {
        let dis = parseInt((amount * parseInt(tos[i].split("_")[1])) / 10000);
        if (!i) dis = amount - total;
        total += dis;
        ops.push([
            "transfer",
            {
                to: tos[i].split("_")[0],
                from: Config("msaccount"),
                amount: `${parseFloat(dis / 1000).toFixed(3)} ${pair.toUpperCase()}`,
                memo:
                    memos +
                    `:${parseFloat(parseInt(tos[i].split("_")[1]) / 100).toFixed(2)}%`,
            },
        ]);
    }
    return ops;
}
