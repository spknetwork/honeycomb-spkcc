import { store, Config }  from "../index.mjs"
import { getPathObj, deleteObjs }  from "./../getPathObj.js"
import { isEmpty }  from "./../lil_ops.js"
import { postToDiscord }  from "./../discord.js"
import hivejs  from "@hiveio/hive-js"
const decode = hivejs.decode
const encode = hivejs.encode

export const node_add = function (json, from, active, pc) {
  if (json.domain && typeof json.domain === "string") {
    var escrow = true;
    if (json.escrow == "false") {
      escrow = false;
    }
    var mirror = false;
    if (json.mirror == "true") {
      mirror = true;
    }
    var mskey;
    if (json.mskey && json.mschallenge) {
      try {
        const verifyKey = decode(Config("msPriMemo"), json.mschallenge);
        const nowhammies = encode(
          Config("msPriMemo"),
          Config("msPubMemo"),
          verifyKey
        );
        const isValid = encode(Config("msPriMemo"), json.mskey, "#try");
        if (
          typeof isValid == "string" &&
          verifyKey == `#${json.mskey}` &&
          nowhammies != json.mschallenge
        )
          mskey = json.mskey;
      } catch (e) {}
    }
    var bid = parseInt(json.bidRate) || 0;
    if (bid < 1) {
      bid = 500;
    }
    if (bid > 1000) {
      bid = 1000;
    }
    var dm = parseInt(json.dm) || 10000; //dex max 10000 = 100.00% / 1 = 0.01%
    //the max size a dex buy order can be ON the buy book in relation to the safety limit determined by collateral amounts
    if (dm < 1) {
      dm = 10000;
    }
    if (dm > 10000) {
      dm = 10000;
    }
    var ds = parseInt(json.ds) || 0; //dex slope 10000 = 100.00% / 1 = 0.01%
    //the max size a dex buy order can be ON the buy book in relation to the current price. 0 = no slope, only max HIVE, 100% means a buy order at 50% of the current tick can be 50% of the dex max HIVE value.
    if (ds < 0) {
      ds = 0;
    }
    if (ds > 10000) {
      ds = 10000;
    }
    var dv = parseInt(json.dv) || 0; //dao vote 10000 = 100.00% / 1 = 0.01%
    //the portion of the claim that will be put into the chains DAO. Recommend 10-15%
    if (dv < 0) {
      dv = 1500;
    }
    if (dv > 10000) {
      dv = 1500;
    }
    var daoRate = parseInt(json.daoRate) || 0;
    if (daoRate < 1) {
      daoRate = 0;
    }
    if (daoRate > 2000) {
      daoRate = 2000;
    }
    var liquidity = parseInt(json.liquidity) || 0;
    if (liquidity < 0) {
      liquidity = 100;
    }
    if (liquidity > 100) {
      liquidity = 100;
    }
    store.get(["markets", "node", from], function (e, a) {
      let ops = [];
      if (!e) {
        if (isEmpty(a)) {
          let data = {
            domain: json.domain || "localhost",
            self: from,
            bidRate: bid,
            daoRate: daoRate,
            attempts: 0,
            yays: 0,
            wins: 0,
            strikes: 0,
            burned: 0,
            moved: 0,
            contracts: 0,
            escrows: 0,
            lastGood: 0,
            report: {},
            dm,
            ds,
            dv,
          };
          if (mskey) data.mskey = mskey;
          ops = [
            {
              type: "put",
              path: ["markets", "node", from],
              data,
            },
          ];
        } else {
          var b = a;
          b.domain = json.domain ? json.domain : b.domain;
          b.bidRate = bid ? bid : b.bidRate;
          b.daoRate = daoRate ? daoRate : b.daoRate;
          b.dm = dm ? dm : b.dm || 10000;
          b.ds = ds ? ds : b.ds || 0;
          b.dv = dv ? dv : b.dv || 1500;
          b.liquidity = liquidity ? liquidity : b.liquidity || 100;
          if (mskey) b.mskey = mskey;
          ops = [{ type: "put", path: ["markets", "node", from], data: b }];
        }
        const msg = `@${from}| has registered the node ${json.domain} at ${json.bidRate}`;
        if (Config("hookurl") || Config("status"))
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
      } else {
        console.log(e);
      }
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    });
  } else {
    let ops = [
      {
        type: "put",
        path: ["feed", `${json.block_num}:${json.transaction_id}`],
        data: `@${from}| sent and invalid node add operation`,
      },
    ];
    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
    store.batch(ops, pc);
  }
};

export const node_delete = function (json, from, active, pc) {
  if (active) {
    var ops = [];
    var Pqueue = getPathObj(["queue"]),
      Pnode = getPathObj(["markets", "node", from]);
    Promise.all([Pqueue, Pnode, Prunners])
      .then(function (v) {
        deleteObjs([["queue"]])
          .then((empty) => {
            var q = v[0],
              n = v[1];
            if (typeof n.bidRate == "number") {
              for (var i = 0; i < q.length; i++) {
                if (q[i] == from) {
                  found = i;
                  break;
                }
              }
              delete q[from];
              ops.push({ type: "put", path: ["queue"], data: q });
              delete b.domain;
              delete b.bidRate;
              delete b.escrow;
              delete b.marketingRate; //legacy
              delete b.daoRate;
              ops.push({ type: "del", path: ["runners", from] });
              ops.push({
                type: "put",
                path: ["markets", "node", from],
                data: b,
              });
              const msg = `@${from}| has signed off their ${Config("TOKEN")} node`;
              if (Config("hookurl") || Config("status"))
                postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: msg,
              });
              if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
              store.batch(ops, pc);
            } else {
              pc[0](pc[2]);
            }
          })
          .catch((e) => {
            console.log(e);
          });
      })
      .catch(function (e) {
        console.log(e);
      });
  } else {
    pc[0](pc[2]);
  }
};
