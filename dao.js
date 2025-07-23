import { store, Config } from "./index.mjs";
import { getPathObj, getPathNum } from "./getPathObj.js"
import { isEmpty, addMT } from './lil_ops.js'
import { sortBuyArray } from './helpers.js'
import stringify from 'json-stable-stringify'
import { CodeShare } from './hot-loader.js'

const MAX_PRICE_MULTIPLIER = 10; // Max 10x price increase
const MIN_ICO_PRICE = 1000;
const MAX_ICO_PRICE = 1000000;

//the daily post, the inflation point for tokennomics
export function dao(num, runtimeContext) {
    return new Promise((resolve, reject) => {
        let post = `## ${Config("TOKEN")} DAO REPORT\n`,
            news = '',
            daops = [],
            daoDels = [],
            Pnews = new Promise(function (resolve, reject) {
                store.get(['postQueue'], function (err, obj) {
                    if (err) {
                        reject(err);
                    } else {
                        var news = isEmpty(obj) ? '' : '*****\n### News from Humans!\n';
                        for (var title in obj) { //postQueue[title].{title,text}
                            news = news + `#### ${title}\n`;
                            news = news + `${obj[title].text}\n\n`;
                        }
                        resolve(news);
                    }
                });
            }),
            Pbals = getPathObj(['balances']),
            Pcbals = getPathObj(['cbalances']),
            Prunners = getPathObj(['runners']),
            Pnodes = getPathObj(['markets', 'node']),
            Pstats = getPathObj(['stats']),
            Pdelegations = getPathObj(['delegations']),
            Pdex = getPathObj(['dex']),
            Pbr = getPathObj(['br']),
            Ppbal = getPathNum(['pow', 't']),
            Pnomen = getPathObj(['nomention']),
            Pposts = getPathObj(['posts']),
            Pfeed = getPathObj(['feed']),
            Ppaid = getPathObj(['paid']),
            Prnfts = getPathObj(['rnfts']),
            Pgov = getPathObj(['gov']),
            Pdistro = Distro()
        Promise.all([Pnews, Pbals, Prunners, Pnodes, Pstats, Pdelegations, Pdex, Pbr, Ppbal, Pnomen, Pposts, Pfeed, Ppaid, Prnfts, Pdistro, Pcbals, Pgov]).then(async function (v) {
            daoDels.push({ type: 'del', path: ['postQueue'] });
            daoDels.push({ type: 'del', path: ['br'] });
            daoDels.push({ type: 'del', path: ['rolling'] });
            daoDels.push({ type: 'del', path: ['stats'] });
            const dels = new Promise((res, rej) => {
                store.batch(daoDels, [res, rej, 0])
            })
            dels.then(async () => {
                news = v[0] + '*****\n';
                const header = post + news;
                var bals = v[1],
                    cbals = v[15],
                    gov = v[16],
                    runners = v[2],
                    mnode = v[3],
                    stats = v[4],
                    deles = v[5],
                    dex = v[6],
                    br = v[7],
                    powBal = v[8],
                    nomention = v[9],
                    cpost = v[10],
                    feedCleaner = v[11],
                    paidCleaner = v[12],
                    rnftsCleaner = v[13],
                    dist = v[14]
                for (var i = 0; i < dist.length; i++) {
                    if (dist[i][0].split('div:')[1]) {
                        addMT(['div', dist[i][0].split('div:')[1], 'b'], dist[i][1])
                    } else {
                        cbals[dist[i][0]] ? cbals[dist[i][0]] += dist[i][1] : cbals[dist[i][0]] = dist[i][1]
                    }
                }
                let feedKeys = Object.keys(feedCleaner);
                let paidKeys = Object.keys(paidCleaner);
                for (var set in rnftsCleaner) {
                    let rnftKeys = Object.keys(rnftsCleaner[set]);
                    for (var rnfti = 0; rnfti < rnftKeys.length; rnfti++) {
                        if (rnftsCleaner[set][rnftKeys[rnfti]] == 0) {
                            daops.push({ type: 'del', path: ['rnfts', set, rnftKeys[rnfti]] });
                        }
                    }
                }
                for (let feedi = 0; feedi < feedKeys.length; feedi++) {
                    if (feedKeys[feedi].split(':')[0] < num - 30240) {
                        daops.push({ type: 'del', path: ['feed', feedKeys[feedi]] });
                    }
                }
                for (let paidi = 0; paidi < paidKeys.length; paidi++) {
                    console.log(paidKeys[paidi])
                    if (parseInt(paidKeys[paidi]) < num - 30240) {
                        console.log(paidKeys[paidi])
                        daops.push({ type: 'del', path: ['paid', paidKeys[paidi].toString()] });
                    }
                }
                news = news;
                var i = 0,
                    j = 0,
                    b = 0,
                    t = 0;
                t = parseInt(bals.ra);
                for (var node in runners) { //node rate
                    // replace marketingRate with daoRate
                    b = parseInt(b) + parseInt(mnode[node].daoRate) || 2500;
                    j = parseInt(j) + parseInt(mnode[node].bidRate) || 2500;
                    i++;
                    console.log(b, j, i);
                }
                if (!i) {
                    b = mnode[Config("leader")].daoRate;
                    j = mnode[Config("leader")].bidRate;
                    i++;
                }
                stats.daoRate = parseInt(b / i);
                stats.nodeRate = parseInt(j / i);
                post = `![${Config("TOKEN")} Advert](${Config("adverts")[num.toString().split('').reduce((a, c) => parseInt(a) + c, 0) % Config("adverts").length]})\n#### Daily Accounting\n`;
                post = post + `Total Supply: ${parseFloat(parseInt(stats.tokenSupply) / 1000).toFixed(3)} ${Config("TOKEN")}\n* ${parseFloat(parseInt(stats.tokenSupply - powBal - (bals.ra + bals.rc + bals.rd + bals.ri + bals.rn + bals.rm)) / 1000).toFixed(3)} ${Config("TOKEN")} liquid\n`;
                post = post + `* ${parseFloat(parseInt(powBal) / 1000).toFixed(3)} ${Config("TOKEN")} Powered up for Voting\n`;
                post = post + `* ${parseFloat(parseInt(bals.ra + bals.rc + bals.rd + bals.ri + bals.rn + bals.rm) / 1000).toFixed(3)} ${Config("TOKEN")} in distribution accounts\n`;
                post = post + `${parseFloat(parseInt(t) / 1000).toFixed(3)} ${Config("TOKEN")} has been generated today. 5% APY.\n${parseFloat(stats.daoRate / 10000).toFixed(4)} is the marketing rate.\n${parseFloat(stats.nodeRate / 10000).toFixed(4)} is the node rate.\n`;
                console.log(`DAO Accounting In Progress:\n${t} has been generated today\n${stats.daoRate} is the DAO allocation rate.\n${stats.nodeRate} is the node rate.`);
                bals.rn += parseInt(t * parseInt(stats.nodeRate) / 10000);
                bals.ra = parseInt(bals.ra) - parseInt(t * parseInt(stats.nodeRate) / 10000);
                bals.rm += parseInt(t * stats.daoRate / 10000);
                if (stats.daoRate) post = post + `${parseFloat(parseInt(t * stats.daoRate / 10000) / 1000).toFixed(3)} ${Config("TOKEN")} moved to Marketing Allocation.\n`;
                if (bals.rm > 1000000000) {
                    bals.rc += bals.rm - 1000000000;
                    post = post + `${parseFloat((bals.rm - 1000000000) / 1000).toFixed(3)} moved from Marketing Allocation to Content Allocation due to Marketing Holdings Cap of 1,000,000.000 ${Config("TOKEN")}\n`;
                    bals.rm = 1000000000;
                }
                bals.ra = parseInt(bals.ra) - parseInt(t * stats.daoRate / 10000);

                i = 0, j = 0;
                if (bals.rm) post = post + `${parseFloat(parseInt(bals.rm) / 1000).toFixed(3)} ${Config("TOKEN")} is in the Marketing Allocation.\n##### Node Rewards for Elected Reports and Escrow Transfers\n`;
                for (var node in mnode) { //tally the wins
                    j = j + parseInt(mnode[node].wins);
                }
                b = bals.rn;

                function _atfun(node) {
                    if (nomention[node]) {
                        return '@_';
                    } else {
                        return '@';
                    }
                }
                var newOwners = {}, dexfeea = 0, dexfeed = 1, dexmaxa = 0, dexslopea = 0, dexmaxd = 1, dexsloped = 1
                if (j) {
                    for (var node in mnode) { //and pay them
                        const wins = mnode[node].wins
                        newOwners[node] = { wins }
                        mnode[node].tw = mnode[node].tw > 0 ? mnode[node].tw + wins : wins
                        mnode[node].wins = 0
                        mnode[node].ty = mnode[node].ty > 0 ? mnode[node].ty + mnode[node].yays : mnode[node].yays
                        mnode[node].yays = 0
                        const gbal = gov[node] || 0
                        mnode[node].g = gbal
                        
                        // Track LP provider metrics before reset
                        if (mnode[node].vS || mnode[node].CCR) {
                            if (!stats.lpProviders) stats.lpProviders = {}
                            stats.lpProviders[node] = {
                                vS: mnode[node].vS || 0,
                                CCR: mnode[node].CCR || 0,
                                g: gbal
                            }
                            // Reset daily metrics
                            mnode[node].vS = 0
                            mnode[node].CCR = 0
                        }
                        const feevote = mnode[node].bidRate > 1000 || mnode[node].bidRate < 0 || typeof mnode[node].bidRate != 'number' ? 1000 : mnode[node].bidRate
                        const dmvote = typeof mnode[node].dm != 'number' ? 10000 : mnode[node].dm
                        const dsvote = typeof mnode[node].ds != 'number' ? 0 : mnode[node].ds
                        mnode[node].ds = dsvote
                        mnode[node].dm = dmvote
                        dexfeea += parseInt(wins * gbal * feevote);
                        dexfeed += parseInt(wins * gbal * 1000);
                        dexmaxa += parseInt(wins * gbal * dmvote);
                        dexmaxd += parseInt(wins * gbal * 10000);
                        dexslopea += parseInt(wins * gbal * dsvote);
                        dexsloped += parseInt(wins * gbal * 10000);
                        i = parseInt(wins / j * b);
                        cbals[node] = cbals[node] ? cbals[node] += i : cbals[node] = i;
                        bals.rn -= i;
                        const _at = _atfun(node);
                        if (i) {
                            post = post + `* ${_at}${node} awarded ${parseFloat(i / 1000).toFixed(3)} ${Config("TOKEN")} for ${wins} credited transaction(s)\n`;
                            console.log(num + `:@${node} awarded ${parseFloat(i / 1000).toFixed(3)} ${Config("TOKEN")} for ${wins} credited transaction(s)`);
                        }
                    }
                }
                stats.dex_fee = parseFloat((dexfeea / dexfeed) / 100).toFixed(5);
                stats.dex_max = parseFloat((dexmaxa / dexmaxd) * 100).toFixed(2);
                stats.dex_slope = parseFloat((dexslopea / dexsloped) * 100).toFixed(2);
                for (var node in newOwners) {
                    newOwners[node].g = runners[node]?.g ? runners[node].g : 0;
                }
                var up_op = accountUpdate(stats, mnode, pick(newOwners))
                function pick(noobj) {
                    var candidates = []
                    var minCollateral = 100000 // Minimum 100 tokens required
                    
                    // Build candidate list with participation metrics
                    for (var node in noobj) {
                        if (noobj[node].g >= minCollateral && noobj[node].wins > 0) {
                            // Calculate participation score
                            var participationScore = 0
                            
                            // Wins contribute to base score
                            participationScore += noobj[node].wins * 10
                            
                            // Verified signatures from node data
                            if (mnode[node].vS) {
                                participationScore += mnode[node].vS * 5
                            }
                            
                            // Total wins history (tw) shows consistency
                            if (mnode[node].tw) {
                                participationScore += Math.min(mnode[node].tw, 1000) // Cap historical contribution
                            }
                            
                            // Yays show consensus participation
                            if (mnode[node].ty) {
                                participationScore += Math.min(mnode[node].ty / 10, 100)
                            }
                            
                            // Recent activity check (lastGood should be recent)
                            if (mnode[node].lastGood && mnode[node].lastGood > num - 200) { // Within last 10 minutes
                                participationScore += 50
                            }
                            
                            candidates.push({ 
                                node, 
                                g: noobj[node].g,
                                score: participationScore,
                                wins: noobj[node].wins
                            })
                        }
                    }
                    
                    // Sort by participation score, then by collateral as tiebreaker
                    candidates.sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score
                        return b.g - a.g
                    })
                    
                    // Take top performers up to max multisig size
                    var out = []
                    var maxNodes = 40 // Maximum nodes in multisig
                    
                    for (var i = 0; i < Math.min(candidates.length, maxNodes); i++) {
                        out.push(candidates[i].node)
                    }
                    
                    // Ensure minimum viable multisig size
                    if (out.length < 3) {
                        // Emergency fallback: add nodes with just collateral requirement
                        for (var node in noobj) {
                            if (!out.includes(node) && noobj[node].g >= minCollateral && out.length < 3) {
                                out.push(node)
                            }
                        }
                    }
                    
                    return out
                }
                bals.rd += parseInt(t * stats.delegationRate / 10000); // 10% to delegators
                if (Config("features").delegate) {
                    post = post + `### ${parseFloat(parseInt(bals.rd) / 1000).toFixed(3)} ${Config("TOKEN")} set aside for @${Config("delegation")} delegators\n`;
                    bals.ra -= parseInt(t * stats.delegationRate / 10000);
                    b = bals.rd;
                    j = 0;
                    console.log(num + `:${b} ${Config("TOKEN")} to distribute to delegators`);
                    for (i in deles) { //count vests
                        j += deles[i];
                    }
                    for (i in deles) { //reward vests
                        k = parseInt(b * deles[i] / j);
                        cbals[i] ? cbals[i] += k : cbals[i] = k;
                        bals.rd -= k;
                        const _at = _atfun(i);
                        post = post + `* ${parseFloat(parseInt(k) / 1000).toFixed(3)} ${Config("TOKEN")} for ${_at}${i}'s ${parseFloat(deles[i] / 1000000).toFixed(1)} Mvests.\n`;
                        console.log(num + `:${k} ${Config("TOKEN")} awarded to ${i} for ${deles[i]} VESTS`);
                    }
                    stats[`${Config("jsonTokenName")}PerDel`] = parseFloat(k / j).toFixed(6);
                }
                var vol = 0,
                    volhbd = 0,
                    vols = 0,
                    volHiveToken = 0,  // TOKEN volume in HIVE market
                    volHbdToken = 0,   // TOKEN volume in HBD market
                    his = [],
                    hisb = [],
                    hi = {},
                    hib = {};
                
                // Initialize volume EMAs if not present
                if (!stats.volumeEMA) {
                    stats.volumeEMA = {
                        hive: {
                            token: 0,    // TOKEN volume in HIVE market
                            hive: 0      // HIVE volume
                        },
                        hbd: {
                            token: 0,    // TOKEN volume in HBD market
                            hbd: 0       // HBD volume
                        },
                        alpha: 0.1       // EMA smoothing factor (~10 periods)
                    };
                }
                
                if (Config("features").dex) {
                    for (var int in dex.hive.his) {
                        if (dex.hive.his[int].block < num - 60480) {
                            his.push(dex.hive.his[int]);
                            daops.push({ type: 'del', path: ['dex', 'hive', 'his', int] });
                        } else {
                            vol = parseInt(parseInt(dex.hive.his[int].base_vol) + vol);
                            volHiveToken = parseInt(parseInt(dex.hive.his[int].base_vol) + volHiveToken);
                            vols = parseInt(parseInt(dex.hive.his[int].target_vol) + vols);
                        }
                    }
                    for (var int in dex.hbd.his) {
                        if (dex.hbd.his[int].block < num - 60480) {
                            hisb.push(dex.hbd.his[int]);
                            daops.push({ type: 'del', path: ['dex', 'hbd', 'his', int] });
                        } else {
                            vol = parseInt(parseInt(dex.hbd.his[int].base_vol || dex.hbd.his[int].amount) + vol);
                            volHbdToken = parseInt(parseInt(dex.hbd.his[int].base_vol || dex.hbd.his[int].amount) + volHbdToken);
                            volhbd = parseInt(parseInt(dex.hbd.his[int].target_vol) + volhbd);
                        }
                    }
                    if (his.length) {
                        hi.o = parseFloat(his[0].price); // open, close, top bottom, dlux, volumepair
                        hi.c = parseFloat(his[his.length - 1].price);
                        hi.t = 0;
                        hi.b = hi.o;
                        hi.d = 0;
                        hi.v = 0;
                        for (var int = 0; int < his.length; int++) {
                            if (hi.t < parseFloat(his[int].price)) {
                                hi.t = parseFloat(his[int].price);
                            }
                            if (hi.b > parseFloat(his[int].price)) {
                                hi.b = parseFloat(his[int].price);
                            }

                            hi.v += parseInt(his[int].target_vol);
                            hi.d += parseInt(his[int].base_vol);
                        }
                        if (!dex.hive.days)
                            dex.hive.days = {};
                        dex.hive.days[num] = hi;
                    }
                    if (hisb.length) {
                        hib.o = parseFloat(hisb[0].price); // open, close, top bottom, dlux, volumepair
                        hib.c = parseFloat(hisb[hisb.length - 1].price);
                        hib.t = 0;
                        hib.b = hib.o;
                        hib.v = 0;
                        hib.d = 0;
                        for (var int = 0; int < hisb.length; int++) {
                            if (hib.t < parseFloat(hisb[int].price)) {
                                hib.t = parseFloat(hisb[int].price);
                            }
                            if (hib.b > parseFloat(hisb[int].price)) {
                                hib.b = parseFloat(hisb[int].price);
                            }
                            hib.v += parseInt(hisb[int].target_vol);
                            hib.d += parseInt(hisb[int].base_vol);
                        }
                        if (!dex.hbd.days)
                            dex.hbd.days = {};
                        dex.hbd.days[num] = hib;
                    }
                    let liqt = Config("features").liquidity ? parseInt((bals.rm / 365) * (stats.liq_reward / 100)) : 0
                    if (liqt > 0) {
                        let liqa = 0
                        for (var acc in dex.liq) {
                            liqa += parseInt(dex.liq[acc])
                        }
                        for (var acc in dex.liq) {
                            var thisd = parseInt(liqt * (dex.liq[acc] / liqa))
                            if (!bals[acc]) bals[acc] = 0
                            bals[acc] += thisd
                            bals.rm -= thisd
                        }
                    }
                    delete dex.liq
                    daops.push({ type: 'del', path: ['dex', 'liq'] })
                    
                    // Update volume EMAs
                    const alpha = stats.volumeEMA.alpha || 0.1;
                    
                    // Update EMAs using: EMA = alpha * current + (1 - alpha) * previous
                    stats.volumeEMA.hive.token = Math.floor(alpha * volHiveToken + (1 - alpha) * stats.volumeEMA.hive.token);
                    stats.volumeEMA.hive.hive = Math.floor(alpha * vols + (1 - alpha) * stats.volumeEMA.hive.hive);
                    stats.volumeEMA.hbd.token = Math.floor(alpha * volHbdToken + (1 - alpha) * stats.volumeEMA.hbd.token);
                    stats.volumeEMA.hbd.hbd = Math.floor(alpha * volhbd + (1 - alpha) * stats.volumeEMA.hbd.hbd);
                    
                    // Calculate volume ratio for balancing decisions
                    const totalTokenEMA = stats.volumeEMA.hive.token + stats.volumeEMA.hbd.token;
                    if (totalTokenEMA > 0) {
                        stats.volumeEMA.hiveRatio = (stats.volumeEMA.hive.token / totalTokenEMA).toFixed(3);
                        stats.volumeEMA.hbdRatio = (stats.volumeEMA.hbd.token / totalTokenEMA).toFixed(3);
                    }
                    
                    post = post + `*****\n### DEX Report\n#### Prices:\n* ${parseFloat(dex.hive.tick).toFixed(3)} HIVE per ${Config("TOKEN")}\n* ${parseFloat(dex.hbd.tick).toFixed(3)} HBD per ${Config("TOKEN")}\n#### Daily Volume:\n* ${parseFloat(vol / 1000).toFixed(3)} ${Config("TOKEN")}\n* ${parseFloat(vols / 1000).toFixed(3)} HIVE\n* ${parseFloat(parseInt(volhbd) / 1000).toFixed(3)} HBD\n#### Volume EMAs:\n* HIVE Market: ${parseFloat(stats.volumeEMA.hive.token / 1000).toFixed(3)} ${Config("TOKEN")} (${stats.volumeEMA.hiveRatio || '0.500'})\n* HBD Market: ${parseFloat(stats.volumeEMA.hbd.token / 1000).toFixed(3)} ${Config("TOKEN")} (${stats.volumeEMA.hbdRatio || '0.500'})\n`;
                    
                    // LP Pool Status
                    if (dex.hive.pool || dex.hbd.pool) {
                        post = post + `#### LP Pools:\n`;
                        if (dex.hive.pool) {
                            post = post + `* HIVE Pool: ${parseFloat((dex.hive.pool.token || 0) / 1000).toFixed(3)} ${Config("TOKEN")} / ${parseFloat((dex.hive.pool.hive || 0) / 1000).toFixed(3)} HIVE\n`;
                        }
                        if (dex.hbd.pool) {
                            post = post + `* HBD Pool: ${parseFloat((dex.hbd.pool.token || 0) / 1000).toFixed(3)} ${Config("TOKEN")} / ${parseFloat((dex.hbd.pool.hbd || 0) / 1000).toFixed(3)} HBD\n`;
                        }
                        post = post + `* Total Collateralized Value: ${parseFloat((stats.MSHeld?.VALUE || 0) / 1000).toFixed(3)} HBD\n`;
                    }
                    
                    // LP Provider Metrics
                    if (stats.lpProviders && Object.keys(stats.lpProviders).length > 0) {
                        post = post + `#### LP Provider Performance:\n`;
                        const sortedProviders = Object.entries(stats.lpProviders)
                            .sort((a, b) => (b[1].vS + b[1].CCR) - (a[1].vS + a[1].CCR))
                            .slice(0, 5); // Top 5
                        
                        for (const [provider, metrics] of sortedProviders) {
                            const _at = _atfun(provider);
                            post = post + `* ${_at}${provider}: vS: ${metrics.vS}, CCR: ${metrics.CCR}\n`;
                        }
                    }
                    
                    post = post + `*****\n`;
                    
                    // Balance LP pools if feature enabled
                    if (Config("features").lp) {
                        try {
                            const { dex_lp_action } = await import('./processing_routes/dex.js');
                            const lpOps = await dex_lp_action({action: "balance_pools"});
                            if (lpOps && lpOps.length > 0) {
                                daops = daops.concat(lpOps);
                                console.log(`LP Balancing: ${lpOps.length} operations queued`);
                                
                                // Log rebalancing details to the report
                                const rebalanceInfo = lpOps.find(op => op.path && op.path[0] === 'rebalance_log');
                                if (rebalanceInfo && rebalanceInfo.data) {
                                    post = post + `#### LP Pool Rebalancing:\n* ${rebalanceInfo.data.message}\n`;
                                }
                            } else {
                                console.log('LP Balancing: No rebalancing needed');
                            }
                        } catch (e) {
                            console.error('LP Balancing error:', e.message || e);
                            post = post + `#### LP Pool Rebalancing Failed:\n* Error: ${e.message || 'Unknown error'}\n`;
                        }
                    }
                }
                if (!stats.movingWeight) stats.movingWeight = {}
                stats.movingWeight.dailyPool = bals.ra
                if (Config("features").pob) bals.rc = bals.rc + bals.ra;
                else bals.rn = bals.rn + bals.ra
                bals.ra = 0;
                var q = 0,
                    r = bals.rc;
                for (var i in br) {
                    q += br[i].post.totalWeight;
                }
                var contentRewards = ``,
                    vo = [];
                if (Object.keys(br).length) {
                    bucket = parseInt(bals.rc / 200);
                    bals.rc = bals.rc - bucket;
                    contentRewards = `#### Top Paid Posts\n`;
                    const compa = bucket;
                    for (var i in br) {
                        var dif = bucket;
                        for (var j in br[i].post.voters) {
                            bals[br[i].post.author] += parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa);
                            cbals[br[i].post.author] ? cbals[br[i].post.author] += parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa) : cbals[br[i].post.author] = parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa);
                            bucket -= parseInt((br[i].post.voters[j].weight / q * 3) * compa);
                            cbals[br[i].post.voters[j].from] ? cbals[br[i].post.voters[j].from] += parseInt((br[i].post.voters[j].weight / q * 3) * compa) : cbals[br[i].post.voters[j].from] = parseInt((br[i].post.voters[j].weight / q * 3) * compa);
                            bucket -= parseInt((br[i].post.voters[j].weight * 2 / q * 3) * compa);
                        }
                        vo.push(br[i].post);
                        cpost[i] = {
                            v: br[i].post.voters.length,
                            d: parseFloat(parseInt(dif - bucket) / 1000).toFixed(3),
                        };
                        cpost[`s/${br[i].post.author}/${br[i].post.permlink}`] = cpost[i];
                        delete cpost[i];
                        contentRewards = contentRewards + `* [${br[i].post.title || `${Config("TOKEN")} Content`}](https://www.${Config("mainFE")}/@${br[i].post.author}/${br[i].post.permlink}) by @${br[i].post.author} awarded ${parseFloat(parseInt(dif - bucket) / 1000).toFixed(3)} ${Config("TOKEN")}\n`;
                    }
                    bals.rc += bucket;
                    contentRewards = contentRewards + `\n*****\n`;
                }
                let tw = 0,
                    ww = 0,
                    ii = 100, //max number of votes
                    hiveVotes = '';
                for (var po = 0; po < vo.length; po++) {
                    tw = tw + vo[po].totalWeight;
                }
                ww = parseInt(tw / 100000);
                vo = sortBuyArray(vo, 'totalWeight');
                if (vo.length < ii)
                    ii = vo.length;
                for (var oo = 0; oo < ii; oo++) {
                    var weight = parseInt(ww * vo[oo].totalWeight);
                    if (weight > 10000)
                        weight = 10000;
                    daops.push({
                        type: 'put',
                        path: ['escrow', Config("delegation"), `vote:${vo[oo].author}:${vo[oo].permlink}`],
                        data: [
                            "vote", {
                                "voter": Config("delegation"),
                                "author": vo[oo].author,
                                "permlink": vo[oo].permlink,
                                "weight": weight
                            }
                        ]
                    });
                    cpost[`s/${vo[oo].author}/${vo[oo].permlink}`].b = weight;
                    hiveVotes = hiveVotes + `* [${vo[oo].title || `${Config("TOKEN")} Content`}](https://www.${Config("mainFE")}/@${vo[oo].author}/${vo[oo].permlink}) by @${vo[oo].author} | ${parseFloat(weight / 100).toFixed(2)}% \n`;
                }
                const footer = `[Visit ${Config("mainFE")}](https://${Config("mainFE")})\n[Visit our DEX/Wallet](https://${Config("mainFE")}/dex)\n[Learn how to use ${Config("TOKEN")}](https://github.com/dluxio/dluxio/wiki)\n[Stop @ Mentions - HiveSigner](https://hivesigner.com/sign/custom-json?authority=posting&required_auths=0&id=${Config("prefix")}nomention&json=%7B%22nomention%22%3Atrue%7D)\n${Config("footer")}`;
                if (hiveVotes)
                    hiveVotes = `#### Community Voted ${Config("TOKEN")} Posts\n` + hiveVotes + `*****\n`;
                
                // Build report nodes structure
                const reportNodes = {
                    header: {
                        order: 0,
                        content: header,
                        data: { stats, advert: Config("adverts")[num.toString().split('').reduce((a, c) => parseInt(a) + c, 0) % Config("adverts").length] }
                    },
                    contentRewards: {
                        order: 1,
                        content: contentRewards,
                        data: { posts: vo, rewards: cpost }
                    },
                    hiveVotes: {
                        order: 2,
                        content: hiveVotes,
                        data: { votes: vo }
                    },
                    dailyAccounting: {
                        order: 3,
                        content: post,
                        data: { stats, balances: bals, powBal }
                    },
                    footer: {
                        order: 4,
                        content: footer,
                        data: { config: Config }
                    }
                };
                
                // Process custom daoFunction if available
                let finalReportNodes = reportNodes;
                let finalDaops = [...daops];  // Create a copy so custom function gets all the ops
                
                let daoFunction = null;
                if(CodeShare.daoFunction) {
                    if(typeof CodeShare.daoFunction === 'function') {
                        daoFunction = CodeShare.daoFunction;
                    } else if(typeof CodeShare.daoFunction === 'string') {
                        try {
                            const df = JSON.parse(CodeShare.daoFunction);
                            if(df && df.body) {
                                const paramsArray = df.params ? Object.values(df.params) : [];
                                daoFunction = new Function(...paramsArray, df.body);
                            }
                        } catch(e) {
                            console.error('Error parsing daoFunction:', e);
                        }
                    } else if(typeof CodeShare.daoFunction === 'object' && CodeShare.daoFunction.body) {
                        const paramsArray = CodeShare.daoFunction.params ? Object.values(CodeShare.daoFunction.params) : [];
                        daoFunction = new Function(...paramsArray, CodeShare.daoFunction.body);
                    }
                }
                
                if(daoFunction) {
                    try {
                        const customResult = await daoFunction(num, runtimeContext, {
                            reportNodes: {...reportNodes},
                            daops: [...daops],
                            stats,
                            balances: bals,
                            data: {
                                nodes: mnode,
                                runners,
                                delegations: deles,
                                dex,
                                posts: cpost,
                                cbals,
                                gov,
                                powBal,
                                nomention,
                                dist
                            }
                        });
                        
                        if(customResult) {
                            if(customResult.reportNodes) {
                                finalReportNodes = customResult.reportNodes;
                            }
                            if(customResult.daops) {
                                finalDaops = customResult.daops;
                            }
                        }
                    } catch(e) {
                        console.error('Error in custom daoFunction:', e);
                    }
                }
                
                // Assemble final report from nodes
                const sortedNodes = Object.values(finalReportNodes).sort((a, b) => a.order - b.order);
                post = sortedNodes.map(node => node.content).join('');
                var op = ["comment",
                    {
                        "parent_author": "",
                        "parent_permlink": Config("tag"),
                        "author": Config("leader"),
                        "permlink": Config("tag") + num,
                        "title": `${Config("TOKEN")} DAO | Block Report ${num}`,
                        "body": post,
                        "json_metadata": JSON.stringify({
                            tags: [Config("tag")]
                        })
                    }
                ];
                console.log(op[1])
                if (up_op) {
                    finalDaops.push({ type: "del", path: ["mso"] });
                    finalDaops.push({
                        type: "put",
                        path: ["mso", `${num}:ac`],
                        data: stringify(["account_update", up_op]),
                    });
                }
                finalDaops.push({ type: 'put', path: ['dex'], data: dex });
                finalDaops.push({ type: 'put', path: ['stats'], data: stats });
                finalDaops.push({ type: 'put', path: ['balances'], data: bals });
                finalDaops.push({ type: 'put', path: ['cbalances'], data: cbals });
                finalDaops.push({ type: 'put', path: ['posts'], data: cpost });
                finalDaops.push({ type: 'put', path: ['markets', 'node'], data: mnode });
                finalDaops.push({ type: 'put', path: ['delegations'], data: deles });
                if (Config("features").daily) finalDaops.push({ type: 'put', path: ['escrow', Config("leader"), 'comment'], data: stringify(op) });
                for (var i = finalDaops.length - 1; i >= 0; i--) {
                    if (finalDaops[i].type == 'put' && Object.keys(finalDaops[i].data).length == 0 && typeof finalDaops[i].data != 'number' && typeof finalDaops[i].data != 'string') {
                        finalDaops.splice(i, 1);
                    }
                }
                for (var bali in bals) {
                    if (bals[bali] == 0 && bali.length > 2) {
                        finalDaops.push({ type: 'del', path: ['balances', bali] });
                    }
                }
                store.batch(finalDaops, [resolve, reject, num]);
            })
        });
    });
}

export function Distro() {
    return new Promise((resolve, reject) => {
        let Pbals = getPathObj(['balances']),
            Psets = getPathObj(['sets']),
            Pdiv = getPathObj(['div'])
        Promise.all([Pbals, Psets, Pdiv]).then(mem => {
            let ops = [],
                bals = mem[0],
                sets = mem[1],
                div = mem[2],
                out = []
            for (var acc in bals) {
                if (acc.split('n:')[1]) {
                    out = [...out, ...preadd(bals[acc], sets[acc.split(':')[1]]), [acc, - bals[acc]]]
                }
            }
            out.sort((a, b) => a[0] - b[0])
            for (var i = 0; i < out.length - 1; i++) {
                if (out[i][0] == out[i + 1][0]) {
                    out[i + 1][1] = out[i][1] + out[i + 1][1]
                    out.splice(i, 1)
                    i--
                }
            }
            resolve(out)
        })
    })
    function preadd(bal, set) {
        if (set.ra) {
            let ret = [],
                accounts = set.ra.split(',')
            out = 0
            for (var i = 0; i < accounts.length - 1; i++) {
                t = parseInt((bal * accounts[i].split('_')[1]) / 10000)
                out += t
                ret.push([accounts[i].split('_')[0] == 'd' ? `div:${set.n}` : accounts[i].split('_')[0], t])
            }
            ret.push([accounts[accounts.length - 1].split('_')[0] == 'd' ? `div:${set.n}` : accounts[i].split('_')[0], bal - out])
            return ret
        } else {
            return [[set.a, bal]]
        }
    }
}

export function Liquidity() {
    return new Promise((resolve, reject) => {
        let Pmarket = getPathObj(['dex'])
        Promise.all([Pmarket]).then(mem => {
            let m = mem[0],
                hiveh = parseFloat(m.hive.buyBook.split('_')[0]),
                hbdh = parseFloat(m.hbd.buyBook.split('_')[0]),
                awards = {}
            if (!m.liq) m.liq = {}
            for (var item in m.hive.buyOrders) {
                const acc = m.hive.buyOrders[item].from
                if (!awards[acc]) awards[acc] = 0
                awards[acc] += parseInt((parseFloat(m.hive.buyOrders[item].rate) / hiveh) * m.hive.buyOrders[item].hive)
            }
            for (var item in m.hbd.buyOrders) {
                const acc = m.hbd.buyOrders[item].from
                if (!awards[acc]) awards[acc] = 0
                awards[acc] += parseInt((parseFloat(m.hbd.buyOrders[item].rate) / hbdh) * m.hbd.buyOrders[item].hbd)
            }
            for (var acc in awards) {
                if (!m.liq[acc]) m.liq[acc] = 0
                m.liq[acc] += awards[acc]
            }
            if (Object.keys(m.liq).length) store.batch([{ type: 'put', path: ['dex', 'liq'], data: m.liq }], [resolve, reject, 'liq_compound'])
            else resolve('no liq')
        })
    })
}

function accountUpdate(stats, nodes, arr) {
    //get runners by gov balance
    //ensure have public key
    var min = Number.MAX_SAFE_INTEGER
    for (var i = 0; i < arr.length; i++) {
        if(nodes[arr[i]].g < min) min = nodes[arr[i]].g
        if (!nodes[arr[i]].mskey) {
            arr.splice(i, 1)
            i--
        }
    }
    
    // Calculate total weight and determine if update needed
    var totalWeight = 0
    var different = false
    var weightedAuths = []
    
    // Build weighted authorities based on governance token holdings
    for (var i = 0; i < arr.length; i++) {
        var node = arr[i]
        // Convert governance tokens to weight (1 weight per min amount, minimum 1)
        var weight = Math.floor(nodes[node].g / min) || 1
        weightedAuths.push([node, weight])
    }
    
    // Sort by weight descending to find top holders
    weightedAuths.sort((a, b) => b[1] - a[1])
    
    // Cap the top 3 weights to prevent single points of failure
    if (weightedAuths.length >= 4) {
        // Find the 4th highest weight as ceiling
        var capWeight = weightedAuths[3][1]
        
        // Cap top 3 to this weight if they exceed it
        for (var i = 0; i < 3 && i < weightedAuths.length; i++) {
            if (weightedAuths[i][1] > capWeight) {
                weightedAuths[i][1] = capWeight
            }
        }
    }
    
    // Recalculate total weight after capping
    totalWeight = 0
    for (var i = 0; i < weightedAuths.length; i++) {
        totalWeight += weightedAuths[i][1]
        
        // Check if current weight differs from stored weight
        if (!stats.ms.active_account_auths[weightedAuths[i][0]] || 
            stats.ms.active_account_auths[weightedAuths[i][0]] != weightedAuths[i][1]) {
            different = true
        }
    }
    
    // Check if all nodes exist in current auths (to detect removed nodes)
    for (var node in stats.ms.active_account_auths) {
        if (!arr.includes(node)) {
            different = true
        }
    }
    
    if (!different || arr.length < 3) return //don't send duplicate updates, don't reduce key holders below 3
    
    if (arr.length > 40) {
        // For large arrays, take top 40 by weight
        weightedAuths.sort((a, b) => b[1] - a[1])
        weightedAuths = weightedAuths.slice(0, 40)
        totalWeight = weightedAuths.reduce((sum, auth) => sum + auth[1], 0)
    }
    
    // Calculate threshold - ensure it's achievable
    var threshold = Math.floor(totalWeight / 2) + 1
    
    // Edge case: if threshold exceeds total weight (e.g., single account scenario)
    if (threshold > totalWeight) {
        threshold = totalWeight
    }
    
    // Edge case: ensure threshold requires at least 2 signers if possible
    if (weightedAuths.length >= 2) {
        // Find the minimum combination of 2 signers
        var minTwoSigners = weightedAuths[weightedAuths.length - 1][1] + 
                           weightedAuths[weightedAuths.length - 2][1]
        if (threshold < minTwoSigners) {
            threshold = minTwoSigners
        }
    }
    
    var updateOp = {
        "account": Config("msaccount"),
        "active": {
            "weight_threshold": threshold,
            "account_auths": weightedAuths,
            "key_auths": []
        },
        "owner": {
            "weight_threshold": threshold,
            "account_auths": weightedAuths,
            "key_auths": []
        },
        "posting": {
            "weight_threshold": 1,
            "account_auths": [[Config("leader"), 1]],
            "key_auths": []
        },
        "memo_key": Config("msPubMemo"),
        "json_metadata": stringify(Config("msmeta"))
    }
    
    return updateOp
}
