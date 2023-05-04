const config = require('./../config')
const { store } = require('./../index')
const { getPathObj, getPathNum, deleteObjs } = require('./../getPathObj')
const { isEmpty } = require('./../lil_ops')
const { postToDiscord } = require('./../discord')
const { Base64, Validator } = require("../helpers")
const { send } = require('@hiveio/hive-js/lib/broadcast')
const { decode, encode } = require('@hiveio/hive-js').memo

exports.register_service_type = function (json, from, active, pc) {
  //get LARYNX balance
  //get current service
  //build service
  //make API
  if(typeof json.type == "string")json.type = json.type.toUpperCase()
  let Pbal = getPathNum(["balances", from]),
    Pstats = getPathObj(["stats"]),
    Preg = getPathObj(['list'])
  Promise.all([Pbal, Pstats, Preg])
    .then((mem) => {
      let fbal = mem[0],
        stats = mem[1],
        list = mem[2],
        ops = [],
        send = parseInt(json.amount);
      if (
        !list[json.type] &&
        send >= stats.IPFSRate * 100 &&
        fbal >= send &&
        active
      ) {
        list[json.type] = from
        ops.push({
          type: "put",
          path: ['list'],
          data: list,
        });
        ops.push({
          type: "put",
          path: ["balances", from],
          data: parseInt(fbal - (stats.IPFSRate * 100)),
        });
        let msg = `@${from}| Registered ${json.type} services with ${parseFloat(
          (stats.IPFSRate * 100) / 1000
        ).toFixed(3)} LARYNX`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
      }
      store.batch(ops, pc);
    })
  }
/*
json.
*/
exports.register_service = function (json, from, active, pc) {
  //get LARYNX balance
  //get current service
  //build service
  //make API
  if(typeof json.type == "string")json.type = json.type.toUpperCase()
  let Pbal = getPathNum(["balances", from]),
    Pservices = getPathObj(["services", from]), //to balance promise
    Pservice = getPathObj(["service", json.type, from]),
    Pac = getPathObj(["services", from, 's']),
    Pstats = getPathObj(["stats"]),
    Preg = getPathObj(['list'])
  Promise.all([Pbal, Pservices, Pstats, Pservice, Pac, Preg])
    .then((mem) => {
      let fbal = mem[0],
        services = mem[1],
        stats = mem[2],
        refByAccount = mem[3],
        accountStats = mem[4],
        list = mem[5],
        ops = [],
        send = parseInt(json.amount);
      if (
        list[json.type] &&
        json.api.length < 256 &&
        json.id &&
        send >= stats.IPFSRate &&
        fbal >= send &&
        active && 
        !services?.[json.type]?.[json.id]
      ) {
        ops.push({
          type: "put",
          path: ["services", from, json.type, json.id],
          data: {
            a: json.api, //api
            i: json.id, //ipfs peerID
            e: 1, //enabled
            b: from, //by
            t: json.type, //type
            c: send, //coin => brand
            s: 0, //score
            w: 0, //weight
            d: 0, //weight decay
            f: 1, //flags
          },
        });
        if(!Object.keys(accountStats).length) accountStats = {i: json.id, //ipfs peerID
          i: `${json.type}:${json.id}`,
          b: from, //by
          c: send, //coin => brand
          s: 0, //score
          w: 0, //weight
          d: 0, //weight decay
          f: 1, //flags
        }
        else {
          accountStats.c += send
          if(accountStats.i.indexOf(json.id) == -1)accountStats.i = accountStats.i + `,${json.type}:${json.id}`
        }
        ops.push({
          type: "put",
          path: ["services", from, 's'],
          data: accountStats,
        })
        var refAccountString = ''
        if(typeof refByAccount == "string") refAccountString = `${refByAccount},${json.id}`
        else refAccountString = json.id
        ops.push({
          //cross reference
          type: "put",
          path: ["service", json.type, from],
          data: refAccountString,
        });
        ops.push({
          type: "put",
          path: ["balances", from],
          data: parseInt(fbal - send),
        });
        let msg = `@${from}| Registered a ${json.type} service with ${parseFloat(
          send / 1000
        ).toFixed(3)} LARYNX`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
      } else if (
        services?.[json.type]?.[json.id] &&
        active &&
        fbal >= send &&
        send
      ){
        services[json.type][json.id].c += send
        ops.push({
          type: "put",
          path: ["services", from, json.type, json.id],
          data: services[json.type][json.id],
        });
        ops.push({
          type: "put",
          path: ["balances", from],
          data: parseInt(fbal - send),
        });
        let msg = `@${from}| Burned ${parseFloat(
          send / 1000
        ).toFixed(3)} LARYNX for their ${json.type} service`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
      } else {
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: `@${from}| Failed to registered a service`,
        });
      }
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    })
    .catch((e) => {
      console.log(e);
    });
};

exports.validator_burn = function (json, from, active, pc) {
    //get LARYNX balance
    //get current service
    //build service
    //make API
    let Pbal = getPathNum(["balances", from]),
      Pnode = getPathObj(['markets', 'node', from]), //to balance promise
      Pstats = getPathObj(["stats"]),
      Pval = getPathObj(["val"]);
    Promise.all([Pbal, Pnode, Pstats, Pval])
      .then((mem) => {
        let fbal = mem[0],
          node = mem[1],
          stats = mem[2],
          vals = mem[3],
          ops = [],
          burn = parseInt(json.amount);
          if(config.mode == 'verbose')console.log('Threshhold', parseFloat(stats.IPFSRate) * ( 1 + Base64.toNumber(stats.validators_registered.split('')[0])))
        if (
          (burn >= parseFloat(stats.IPFSRate) * ( 1 + Base64.toNumber(stats.validators_registered.split('')[0])) || node.val_code) && //fee to register validator node with increase every 64 registrations
          fbal >= burn &&
          active
        ) { 
          var msg = `@${from}| Burned ${parseFloat(
            burn / 1000
          ).toFixed(3)} LARYNX to their validator`;
            if(!node.burned){
                var next_code = Base64.fromNumber(Base64.toNumber(stats.validators_registered) + 1)
                if (next_code.split('').length == 1)next_code = "0" + next_code
                node.val_code = next_code
                vals[next_code] = 0
                stats.validators_registered = next_code
                msg = `@${from}| Registered a validator with ${parseFloat(
                  burn / 1000
                ).toFixed(3)} LARYNX`;
                ops.push({
                    type: "put",
                    path: ["val"],
                    data: vals,
                  });
                  ops.push({
                    type: "put",
                    path: ["stats"],
                    data: stats,
                  });
            }
            node.burned += burn
          ops.push({
            type: "put",
            path: ['markets', 'node', from],
            data: node});
          ops.push({
            type: "put",
            path: ["balances", from],
            data: parseInt(fbal - burn),
          });
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
        } else {
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: `@${from}| Validator registration failed`,
          });
        }
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      })
      .catch((e) => {
        console.log(e);
      });
  };

exports.node_add = function(json, from, active, pc) {
    if (json.domain && typeof json.domain === 'string') {

        var mskey
        if (json.mskey && json.mschallenge){
            try {
                const verifyKey = decode(config.msPriMemo, json.mschallenge)
                const nowhammies = encode(config.msPriMemo, config.msPubMemo, verifyKey)
                const isValid = encode(config.msPriMemo, json.mskey, '#try')
                if (typeof isValid == 'string' && verifyKey == `#${json.mskey}` && nowhammies != json.mschallenge)mskey = json.mskey
            } catch (e) {}
        }
        store.get(['markets', 'node', from], function(e, a) {
            let ops = []
            if (!e) {
                if (isEmpty(a)) {
                    data = {
                            domain: json.domain || 'localhost',
                            self: from,
                            attempts: 0,
                            yays: 0,
                            wins: 0,
                            strikes: 0,
                            burned: 0,
                            lastGood: 0,
                            report: {},
                        }
                    if(mskey)data.mskey = mskey
                    ops = [{
                        type: 'put',
                        path: ['markets', 'node', from],
                        data
                    }]
                } else {
                    var b = a;
                    b.domain = json.domain ? json.domain : b.domain;
                    if(mskey)b.mskey = mskey
                    ops = [{ type: 'put', path: ['markets', 'node', from], data: b }]
                }
                const msg = `@${from}| has bid the hive-state node ${json.domain} at ${json.bidRate}`
                if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
                ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
            } else {
                console.log(e)
            }
            if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
            store.batch(ops, pc)
        })
    } else {
        ops = [{ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| sent and invalid node add operation` }]
        if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
        store.batch(ops, pc)
    }
}