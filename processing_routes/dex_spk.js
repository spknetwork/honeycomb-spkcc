const config = require("./../config");

const { Base64, NFT, DEX } = require("./../helpers");
const { store, GetNodeOps, spliceOp, plasma } = require("./../index");
const { getPathObj, getPathNum } = require("./../getPathObj");
const {
  add,
  addCol,
  addGov,
  deletePointer,
  credit,
  chronAssign,
  hashThis,
  isEmpty,
  addMT,
} = require("./../lil_ops");
const { postToDiscord } = require("./../discord");
const stringify = require("json-stable-stringify");
const fetch = require("node-fetch");

exports.spk_dex_sell = (json, from, active, pc) => {
  let PfromBal = getPathNum(["spk", from]),
    PStats = getPathObj(["stats"]),
    PSB = getPathObj(["dexs", "hive"]),
    order = {};
  if (parseInt(json.hive)) {
    order.type = "LIMIT";
    order.target = parseInt(json.hive);
    order.rate = parseFloat(
      parseInt(json.hive) / parseInt(json["spk"])
    ).toFixed(6);
    order.pair = "hive";
  } else if (parseInt(json.hbd)) {
    PSB = getPathObj(["dexs", "hbd"]);
    order.type = "LIMIT";
    order.pair = "hbd";
    order.target = parseInt(json.hbd);
    order.rate = parseFloat(
      parseInt(json.hbd) / parseInt(json["spk"])
    ).toFixed(6);
  } else if (json.pair == "HBD") {
    PSB = getPathObj(["dexs", "hbd"]);
    order.type = "MARKET";
    order.pair = "hbd";
  } else {
    order = {
      type: "MARKET",
      pair: "hive",
      amount: json["spk"],
    };
  }
  if (parseFloat(order.rate) < 0) {
    (order.type = "MARKET"), delete order.rate;
  }
  order["spk"] = parseInt(json["spk"]);
  Promise.all([PfromBal, PStats, PSB])
    .then((a) => {
      let bal = a[0],
        stats = a[1],
        dex = a[2],
        ops = [],
        adds = [],
        his = {},
        fee = 0,
        hours = parseInt(json.hours) || 720;
      if (hours > 720) {
        hours = 720;
      }
      const expBlock = json.block_num + hours * 1200;
      if (
        order["spk"] <= bal &&
        order["spk"] >= 4 &&
        active
      ) {
        let remaining = json["spk"],
          filled = 0,
          pair = 0,
          i = 0,
          path = 0,
          contract = "";
        sell_loop: while (remaining) {
          let price = dex.buyBook
            ? parseFloat(dex.buyBook.split("_")[0])
            : dex.tick;
          let item = dex.buyBook ? dex.buyBook.split("_")[1].split(",")[0] : "";
          console.log({ json, item, price, order });
          if (
            item &&
            (order.type == "MARKET" ||
              parseFloat(price) >= parseFloat(order.rate))
          ) {
            let next = dex.buyOrders?.[`${price.toFixed(6)}:${item}`];
            if (!next) {
              dex.buyBook = DEX.remove(item, dex.buyBook);
              continue sell_loop;
            }
            if (next.amount <= remaining) {
              if (next[order.pair]) {
                filled += next.amount;
                adds.push([next.from, next.amount - next.fee]);
                his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                  type: "sell",
                  t: Date.parse(json.timestamp + ".000Z"),
                  block: json.block_num,
                  base_vol: next.amount,
                  target_vol: next[order.pair],
                  target: order.pair,
                  price: next.rate,
                  id: json.transaction_id + i,
                };
                fee += next.fee; //add the fees
                remaining -= next.amount;
                dex.tick = price.toFixed(6);
                pair += next[order.pair];
                dex.buyBook = DEX.remove(item, dex.buyBook); //adjust the orderbook
                delete dex.buyOrders[`${price.toFixed(6)}:${item}`];
                const transfer = [
                  "transfer",
                  {
                    from: config.msaccount,
                    to: from,
                    amount:
                      parseFloat(next[order.pair] / 1000).toFixed(3) +
                      " " +
                      order.pair.toUpperCase(),
                    memo: `Filled ${item}:${json.transaction_id}`,
                  },
                ];
                let msg = `@${from} sold ${parseFloat(
                  parseInt(next.amount) / 1000
                ).toFixed(3)} ${config.TOKEN} with ${parseFloat(
                  parseInt(next[order.pair]) / 1000
                ).toFixed(3)} ${order.pair.toUpperCase()} to ${
                  next.from
                } (${item})`;
                ops.push({
                  type: "put",
                  path: [
                    "feed",
                    `${json.block_num}:${json.transaction_id}.${i}`,
                  ],
                  data: msg,
                });
                ops.push({
                  type: "put",
                  path: [
                    "msa",
                    `${item}:${json.transaction_id}:${json.block_num}`,
                  ],
                  data: stringify(transfer),
                }); //send HIVE out via MS
                ops.push({
                  type: "del",
                  path: [
                    "dexs",
                    order.pair,
                    "buyOrders",
                    `${price.toFixed(6)}:${item}`,
                  ],
                }); //remove the order
                ops.push({ type: "del", path: ["contracts", next.from, item] }); //remove the contract
                ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
              } else {
                fee += next.fee;
                fee += next.amount;
                dex.buyBook = DEX.remove(item, dex.buyBook);
                delete dex.buyOrders[`${price.toFixed(6)}:${item}`];
                ops.push({
                  type: "del",
                  path: [
                    "dexs",
                    order.pair,
                    "buyOrders",
                    `${price.toFixed(6)}:${item}`,
                  ],
                }); //remove the order
                ops.push({ type: "del", path: ["contracts", next.from, item] }); //remove the contract
                ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
              }
            } else {
              const thisfee = parseInt((remaining / next.amount) * next.fee);
              const thistarget = parseInt(
                (remaining / next.amount) * next[order.pair]
              );
              if (thistarget) {
                next.fee -= thisfee;
                next[order.pair] -= thistarget;
                next.amount -= remaining;
                filled += remaining;
                pair += thistarget;
                var partial = {
                  coin: thistarget,
                  token: remaining + thisfee,
                };
                if (next.partial) {
                  next.partial[`${json.transaction_id}`] = partial;
                } else {
                  next.partial = {
                    [`${json.transaction_id}`]: partial,
                  };
                }
                adds.push([next.from, remaining - thisfee]);
                dex.tick = price.toFixed(6);
                his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                  type: "sell",
                  t: Date.parse(json.timestamp),
                  block: json.block_num,
                  base_vol: remaining + thisfee,
                  target_vol: thistarget,
                  target: order.pair,
                  price: next.rate,
                  id: json.transaction_id + i,
                };
                fee += thisfee;
                const transfer = [
                  "transfer",
                  {
                    from: config.msaccount,
                    to: from,
                    amount:
                      parseFloat(thistarget / 1000).toFixed(3) +
                      " " +
                      order.pair.toUpperCase(),
                    memo: `Partial Filled ${item}:${json.transaction_id}`,
                  },
                ];
                let msg = `@${from} sold ${parseFloat(
                  parseInt(remaining) / 1000
                ).toFixed(3)} ${config.TOKEN} with ${parseFloat(
                  parseInt(thistarget) / 1000
                ).toFixed(3)} ${order.pair.toUpperCase()} to ${
                  next.from
                } (${item})`;
                ops.push({
                  type: "put",
                  path: [
                    "feed",
                    `${json.block_num}:${json.transaction_id}.${i}`,
                  ],
                  data: msg,
                });
                ops.push({
                  type: "put",
                  path: [
                    "msa",
                    `${item}:${json.transaction_id}:${json.block_num}`,
                  ],
                  data: stringify(transfer),
                }); //send HIVE out via MS
                ops.push({
                  type: "put",
                  path: ["contracts", next.from, item],
                  data: next,
                }); //remove the contract
                dex.buyOrders[`${price.toFixed(6)}:${item}`] = next;
                remaining = 0;
              } else {
                fee += remaining;
                remaining = 0;
              }
            }
          } else {
            let txid = config.TOKEN + hashThis(from + json.transaction_id),
              crate =
                typeof parseFloat(order.rate) == "number"
                  ? parseFloat(order.rate).toFixed(6)
                  : dex.tick,
              cfee =
                parseFloat(stats.dex_fee) > 0
                  ? parseInt(parseInt(remaining) * parseFloat(stats.dex_fee)) + 1
                  : parseInt(parseInt(remaining) * 0.005) + 1,
              hours = 720;
            if (crate > 0) {
              contract = {
                txid,
                from: from,
                hive: 0,
                hbd: 0,
                fee: cfee,
                amount: remaining,
                rate: crate,
                block: json.block_num,
                type: `${order.pair}:sell`,
                hive_id: json.transaction_id,
              };
              contract[order.pair] = parseInt(remaining * parseFloat(crate));
              dex.sellBook = DEX.insert(txid, crate, dex.sellBook, "sell");
              path = [
                expBlock,
                {
                  block: expBlock,
                  op: "expires",
                  from,
                  txid,
                },
              ];
              remaining = 0;
            } else {
              bal += remaining;
              remaining = 0;
            }
          }
          i++;
        }
        var addops = {};
        for (var j = 0; j < adds.length; j++) {
          if (addops[adds[j][0]]) {
            addops[adds[j][0]] += adds[j][1];
          } else {
            addops[adds[j][0]] = adds[j][1];
          }
        }
        bal -= json["spk"];
        if (addops[from]) {
          bal += addops[from];
          delete addops[from];
        }
        const msg = `@${from}| Sell order confirmed.`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        ops.push({ type: "put", path: ["spk", from], data: bal });
        ops.push({ type: "put", path: ["dexs", order.pair], data: dex });
        if (Object.keys(his).length)
          ops.push({
            type: "put",
            path: ["dexs", order.pair, "his"],
            data: his,
          });
        addMT(["spk", "rn"], fee).then((empty) => {
          addop(0, addops);
        });
        function addop(i, a) {
          var keys = Object.keys(a);
          if (i < keys.length) {
            add(["spk", keys[i]], a[keys[i]]).then((empty) => {
              if (keys.length > i + 1) {
                addop(i + 1, a);
              } else {
                finish();
              }
            });
          } else {
            finish();
          }
        }
        function finish() {
          if (path) {
            chronAssign(path[0], path[1]).then((expPath) => {
              contract.expire_path = expPath;
              ops.push({
                type: "put",
                path: ["contracts", from, contract.txid],
                data: contract,
              });
              if (dex.sellOrders) {
                dex.sellOrders[`${contract.rate}:${contract.txid}`] = contract;
              } else {
                dex.sellOrders = {
                  [`${contract.rate}:${contract.txid}`]: contract,
                };
              }
              let msg = `@${from} is selling ${parseFloat(
                parseInt(contract.amount) / 1000
              ).toFixed(3)} ${config.TOKEN} for ${parseFloat(
                parseInt(contract[order.pair]) / 1000
              ).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${
                contract.txid
              })`;
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
                data: msg,
              });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            });
          } else {
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            store.batch(ops, pc);
          }
        }
      } else {
        const msg = `@${from}| tried to sell ${config.TOKEN} but sent an invalid order.`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops = [
          {
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          },
        ];
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      }
    })
    .catch((e) => {
      console.log(e);
    });
};

exports.spk_dex_clear = (json, from, active, pc) => {
  if (active) {
    var q = [];
    if (typeof json.txid == "string") {
      q.push(json.txid);
    } else {
      pc[0](pc[2]);
    }
    // else {
    //     q = json.txid
    // } //book string collision
    for (i = 0; i < q.length; i++) {
      store.get(["contracts", from, q[i]], function (e, a) {
        if (!e) {
          var b = a;
          switch (b.type) {
            case "hive:sell":
              store.get(
                ["dexs", "hive", "sellOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            case "hbd:sell":
              store.get(
                ["dexs", "hbd", "sellOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            case "hive:buy":
              store.get(
                ["dexs", "hive", "buyOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            case "hbd:buy":
              store.get(
                ["dexs", "hbd", "buyOrders", `${b.rate}:${b.txid}`],
                function (e, a) {
                  if (e) {
                    pc[0](pc[2]);
                  } else if (isEmpty(a)) {
                    console.log("Nothing here" + b.txid);
                  } else {
                    release(from, b.txid, json.block_num, json.transaction_id)
                      .then((y) => pc[0](pc[2]))
                      .catch((e) => {
                        rej(e);
                      });
                  }
                }
              );
              break;
            default:
              pc[0](pc[2]);
          }
        } else {
          pc[0](pc[2]);
          console.log(e);
        }
      });
    }
  } else {
    pc[0](pc[2]);
  }
};

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
        from: config.msaccount,
        amount: `${parseFloat(dis / 1000).toFixed(3)} ${pair.toUpperCase()}`,
        memo:
          memos +
          `:${parseFloat(parseInt(tos[i].split("_")[1]) / 100).toFixed(2)}%`,
      },
    ]);
  }
  return ops;
}

function enforce(str) {
  str = str || "";
  let enforce = {},
    arr = str.split(",");
  for (let i = 0; i < arr.length; i++) {
    let s = arr[i].split(":");
    enforce[s[0]] = arr[i].replace(`${s[0]}:`, "");
  }
  return enforce;
}

const release = (from, txid, bn, tx_id) => {
  return new Promise((resolve, reject) => {
    store.get(["contracts", from, txid], function (er, a) {
      if (er) {
        console.log(er);
      } else {
        var ops = [];
        switch (a.type) {
          case "hive:sell":
            store.get(["dexs", "hive"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.sellOrders[`${a.rate}:${a.txid}`];
                res.sellBook = DEX.remove(a.txid, res.sellBook);
                ops.push({
                  type: "put",
                  path: ["dexs", "hive", "sellBook"],
                  data: res.sellBook,
                });
                addMT(["spk", r.from], r.amount)
                  .then((empty) => {
                    ops.push({ type: "del", path: ["contracts", from, txid] });
                    ops.push({ type: "del", path: ["chrono", a.expire_path] });
                    ops.push({
                      type: "del",
                      path: [
                        "dexs",
                        "hive",
                        "sellOrders",
                        `${a.rate}:${a.txid}`,
                      ],
                    });
                    if (tx_id && config.hookurl) {
                      postToDiscord(
                        `@${from} has canceled ${txid}`,
                        `${bn}:${tx_id}`
                      );
                    }
                    store.batch(ops, [resolve, reject]);
                  })
                  .catch((e) => {
                    reject(e);
                  });
              }
            });
            break;
          case "hbd:sell":
            store.get(["dexs", "hbd"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.sellOrders[`${a.rate}:${a.txid}`];
                res.sellBook = DEX.remove(a.txid, res.sellBook);
                ops.push({
                  type: "put",
                  path: ["dexs", "hbd", "sellBook"],
                  data: res.sellBook,
                });
                addMT(["spk", r.from], r.amount)
                  .then((empty) => {
                    ops.push({ type: "del", path: ["contracts", from, txid] });
                    ops.push({ type: "del", path: ["chrono", a.expire_path] });
                    ops.push({
                      type: "del",
                      path: ["dexs", "hbd", "sellOrders", `${a.rate}:${a.txid}`],
                    });
                    if (tx_id && config.hookurl) {
                      postToDiscord(
                        `@${from} has canceled ${txid}`,
                        `${bn}:${tx_id}`
                      );
                    }
                    store.batch(ops, [resolve, reject]);
                  })
                  .catch((e) => {
                    reject(e);
                  });
              }
            });
            break;
          case "hive:buy":
            store.get(["dexs", "hive"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.buyOrders[`${a.rate}:${a.txid}`];
                res.buyBook = DEX.remove(a.txid, res.buyBook);
                ops.push({
                  type: "put",
                  path: ["dexs", "hive", "buyBook"],
                  data: res.buyBook,
                });
                a.cancel = true;
                const Transfer = [
                  "transfer",
                  {
                    from: config.msaccount,
                    to: a.from,
                    amount: parseFloat(a.hive / 1000).toFixed(3) + " HIVE",
                    memo: `Canceled ${config.TOKEN} buy ${a.txid}`,
                  },
                ];
                ops.push({
                  type: "put",
                  path: ["msa", `refund@${a.from}:${a.txid}:${bn}`],
                  data: stringify(Transfer),
                });
                ops.push({ type: "del", path: ["contracts", from, a.txid] });
                ops.push({
                  type: "del",
                  path: ["dexs", "hive", "buyOrders", `${a.rate}:${a.txid}`],
                });
                if (tx_id && config.hookurl) {
                  postToDiscord(
                    `@${from} has canceled ${txid}`,
                    `${bn}:${tx_id}`
                  );
                }
                store.batch(ops, [resolve, reject]);
              }
            });
            break;
          case "hbd:buy":
            store.get(["dexs", "hbd"], function (e, res) {
              if (e) {
                console.log(e);
              } else if (isEmpty(res)) {
                console.log("Nothing here" + a.txid);
              } else {
                r = res.buyOrders[`${a.rate}:${a.txid}`];
                res.buyBook = DEX.remove(a.txid, res.buyBook);
                ops.push({
                  type: "put",
                  path: ["dexs", "hbd", "buyBook"],
                  data: res.buyBook,
                });
                a.cancel = true;
                const Transfer = [
                  "transfer",
                  {
                    from: config.msaccount,
                    to: a.from,
                    amount: parseFloat(a.hbd / 1000).toFixed(3) + " HBD",
                    memo: `Canceled ${config.TOKEN} buy ${a.txid}`,
                  },
                ];
                ops.push({
                  type: "put",
                  path: ["msa", `refund@${a.from}:${a.txid}:${bn}`],
                  data: stringify(Transfer),
                });
                ops.push({ type: "del", path: ["contracts", from, a.txid] });
                ops.push({
                  type: "del",
                  path: ["dexs", "hbd", "buyOrders", `${a.rate}:${a.txid}`],
                });
                if (tx_id && config.hookurl) {
                  postToDiscord(
                    `@${from} has canceled ${txid}`,
                    `${bn}:${tx_id}`
                  );
                }
                store.batch(ops, [resolve, reject]);
              }
            });
            break;
          default:
            resolve();
        }
      }
    });
  });
};
exports.release = release;

//change stats to msheld {}

exports.margins = function (bn) {
  return new Promise((resolve, reject) => {
    var Pstats = getPathObj(["stats"]),
      Pdex = getPathObj(["dexs"]),
      Pmsa = getPathObj(["msa"]),
      Pmss = getPathObj(["mss"]);
    Promise.all([Pstats, Pdex, Pmsa, Pmss]).then((mem) => {
      var stats = mem[0],
        dex = mem[1],
        msa = mem[2],
        mss = mem[3];
      if (Object.keys(msa).length)
        for (var x in msa) {
          if (typeof msa[x] == "string")
            msa[x].split('amount":"').forEach((y) => {
              const amount = y.split('"')[0],
                type = amount.split(" ")[1],
                mt = parseInt(parseFloat(amount.split(" ")[0]) * 1000);
              if (type == "HIVE") {
                stats.MSHeld.HIVE -= mt;
              } else if (type == "HBD") {
                stats.MSHeld.HBD -= mt;
              }
            });
        }
      if (Object.keys(mss).length)
        for (var x in mss) {
          if (typeof mss[x] == "string")
            mss[x].split('amount":"').forEach((y) => {
              const amount = y.split('"')[0],
                type = amount.split(" ")[1],
                mt = parseInt(parseFloat(amount.split(" ")[0]) * 1000);
              if (type == "HIVE") {
                stats.MSHeld.HIVE -= mt;
              } else if (type == "HBD") {
                stats.MSHeld.HBD -= mt;
              }
            });
        }
      var allowedHive = parseInt(
          stats.multiSigCollateral * parseFloat(dex.hive.tick)
        ),
        allowedHBD = parseInt(
          stats.multiSigCollateral * parseFloat(dex.hbd.tick)
        ),
        changed = [];
      promises = [];
      if (stats.MSHeld.HIVE > allowedHive && !config.mirrorNet)
        console.log(stats.MSHeld.HIVE, { allowedHive });
      if (stats.MSHeld.HIVE > allowedHive) {
        var p = dex.hive.buyBook.split(","),
          price = p[p.length - 1].split("_")[0],
          items = p[p.length - 1].split("_");
        for (var i = 1; i < items.length; i++) {
          if (dex.hive.buyOrders[`${price}:${items[i]}`])
            promises.push(
              release(
                dex.hive.buyOrders[`${price}:${items[i]}`].from,
                items[i],
                bn,
                `${bn}_hive_collateral_vop`
              )
            );
          else {
            changed.push([items[i], "hive"]);
          }
        }
      }
      if (stats.MSHeld.HBD > allowedHBD) {
        var p = dex.hbd.buyBook.split(","),
          price = p[p.length - 1].split("_")[0],
          items = p[p.length - 1].split("_");
        for (var i = 1; i < items.length; i++) {
          if (dex.hbd.buyOrders[`${price}:${items[i]}`])
            promises.push(
              release(
                dex.hbd.buyOrders[`${price}:${items[i]}`].from,
                items[i],
                bn,
                `${bn}_hbd_collateral_vop`
              )
            );
          else {
            changed.push([items[i], "hbd"]);
          }
        }
      }
      if (promises.length > 0) {
        Promise.all(promises).then(() => {
          if (!changed.length) resolve("Pruned");
          else removeItems(changed, resolve);
        });
      } else {
        if (!changed.length) resolve("No pruning");
        else removeItems(changed, resolve);
      }
    });
  });
};

function removeItems(arr, p) {
  let phive = getPathObj(["dexs", "hive", "buyBook"]),
    phbd = getPathObj(["dexs", "hbd", "buyBook"]);
  Promise.all([phive, phbd]).then((mem) => {
    var hive = mem[0],
      hbd = mem[1];
    for (var i = 0; i < arr.length; i++) {
      console.log("Cleaned: ", arr[i][0]);
      if (arr[i][1] == "hive") hive = DEX.remove(arr[i][0], hive);
      if (arr[i][1] == "hbd") hbd = DEX.remove(arr[i][0], hbd);
    }
    store.batch(
      [
        { type: "put", path: ["dexs", "hive", "buyBook"], data: hive },
        { type: "put", path: ["dexs", "hbd", "buyBook"], data: hbd },
      ],
      [p, "error", "Pruned"]
    );
  });
}

function nai(obj) {
  return `${parseFloat(obj.amount.amount / Math.pow(10, obj.precision))} ${
    obj.amount.nai == "@@000000021" ? "HIVE" : "HBD"
  }`;
}
function naizer(obj) {
  if (typeof obj.amount != "string") return obj;
  else {
    const nai =
      obj.amount.split(" ")[1] == "HIVE" ? "@@000000021" : "@@000000013";
    const amount = parseInt(
      parseFloat(obj.amount.split(" ")[0]) * 1000
    ).toString();
    const precision = 3;
    obj.amount = {
      amount,
      nai,
      precision,
    };
    return obj;
  }
}

function maxAllowed(stats, tick, remaining, crate) {
  const max =
    stats.safetyLimit *
    tick *
    (1 - (crate < tick ? (crate / tick) : 0 ) * (stats.dex_slope / 100)) *
    (stats.dex_max / 100);
  return max > remaining ? 0 : parseInt(remaining - max);
}
