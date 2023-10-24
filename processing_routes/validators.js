const config = require("./../config");
const { store } = require("./../index");
const { getPathObj, getPathNum, deleteObjs, getPathSome } = require("./../getPathObj");
const { isEmpty } = require("./../lil_ops");
const { postToDiscord } = require("./../discord");
const { decode, encode } = require("@hiveio/hive-js").memo;
const { Base64, Base58, Base38 } = require("./../helpers");
const { chronAssign } = require("./../lil_ops");
//const { poa } = require("./validators");
const fetch = require("node-fetch");
const WebSocketClient = require('websocket').client


var PoA = {
  Pending: {
      vals: 0
  },
  Check: function (b, rand, stats, val, cBroca, pc){
    var promises = []
    for(var i = 0; i < b.report.v.length; i++){
      const [gte, lte] = this.getRange(rand[b.report.v[i][1]], b.self, val, stats)
      const rev = b.report.v[i][0].split("").reverse().join("")
      console.log('lottery:', gte, rev.substr(0,9), lte)
      if(Base58.toNumber(rev.substr(0,gte.length)) >= Base58.toNumber(gte) && Base58.toNumber(rev.substr(0,lte.length)) <= Base58.toNumber(lte)){
        promises.push(getPathObj(['IPFS', rev]))
      } else {
        b.report.v.splice(i,1)
        i--
      }
    }
    if(promises.length)Promise.all(promises).then(contractIDs=>{
      promises = []
        for(var i = 0; i < contractIDs.length; i++){
          promises.push(getPathObj(['contract', contractIDs[i].split(',')[0], contractIDs[i].split(',')[1]]))
        }
        if (promises.length) Promise.all(promises).then(contracts => {
          for (var i = 0; i < contracts.length; i++) {
            const reward = parseInt((contracts[i].p * contracts[i].r * contracts[i].df[b.report.v[i][0]]) / (contracts[i].u * 3))
            console.log({reward})
            cBroca[b.self] = cBroca[b.self] ? cBroca[b.self] + reward : reward
            for(var j = 2; j < b.report.v[i].length; j ++){
              console.log({j})
              if(j < contracts[i].p + 2)cBroca[b.report.v[i][j][0]] = cBroca[b.report.v[i][j][0]] ? 
                cBroca[b.report.v[i][j][0]] + parseInt((reward * contracts[i].p) / (contracts[i].p > b.report.v[i].length - 2 ? b.report.v[i].length - 2 : contracts[i].p)):
                parseInt((reward * contracts[i].p) / (contracts[i].p > b.report.v[i].length - 2 ? b.report.v[i].length - 2 : contracts[i].p))
              else cBroca[b.report.v[i][j][0]] = cBroca[b.report.v[i][j][0]] ? 
                cBroca[b.report.v[i][j][0]] + parseInt(reward / Math.pow(j - 1 - contracts[i].p, 2)):
                parseInt(reward / Math.pow(j - 1 - contracts[i].p, 2))
            }
          }
          delete b.report.v
          var ops = [{type: "put", path: ["markets", "node", b.self], data: b}, {type: "put", path: ["cbroca"], data: cBroca}]
          store.batch(ops, pc)
      })
      else store.batch([{type: "put", path: ["markets", "node", b.self], data: b}], pc)
    })
    else store.batch([{type: "put", path: ["markets", "node", b.self], data: b}], pc)
  },
  BlackListed: function (reversedCID){
    return new Promise((resolve, reject) => {
      const CID = reversedCID.split("").reverse().join("")
      fetch(`${config.BlackListURL}/flag-qry/${CID}`).then(r => r.json()).then(json =>{
        if(json.flag)resolve(true)
        else resolve(false)
      }).catch(e=> resolve(false))
    })
  },
  Validate: function (block, prand, stats, account = config.username) {
      //get val, match with this account
      this.Pending[ `${block % 200}` ] = {}
      let Pval = getPathObj(['val'])
      let Pnode = getPathObj(['markets', 'node', account])
      Promise.all([Pval, Pnode]).then(mem => {
          const val = mem[0],
              node = mem[1]
          if (node.val_code && val[account]) {
              const [gte, lte] = this.getRange(prand, account, val, stats)
              getPathSome(["IPFS"], { gte, lte }).then(items => { //need to wrap this call to 0 thru remainder 
                var promises = [], toVerify = {}, BlackListed = []
                for(var i = 0; i < items.length; i++){
                  BlackListed.push(PoA.checkForFlags(items[i]))
                  promises.push(getPathObj(['IPFS', items[i]]))
                }
                Promise.all(BlackListed).then(flags => {
                  for(var i = flags.length -1; i >= 0; i--){
                    if(flags[i])promises.splice(i, 1)
                  }
                  Promise.all(promises).then(contractIDs=>{
                    promises = []
                    for(var i = 0; i < contractIDs.length; i++){
                      promises.push(getPathObj(['contract', contractIDs[i].split(',')[0], contractIDs[i].split(',')[1]]))
                      const asset = items[i].split("").reverse().join("")
                          toVerify[asset] = {
                              r: items[i],
                              a: asset,
                              fo: contractIDs[i].split(',')[0],
                              id: contractIDs[i].split(',')[1]
                          }
                    }
                    if (promises.length) Promise.all(promises).then(contracts => {
                        promises = [], k = []
                        for (var i = 0; i < contracts.length; i++) {
                          const dfKeys =  contracts[i].df ? Object.keys(contracts[i].df) : []
                            for (var j = 0; j < dfKeys.length; j++) {
                                if (toVerify[dfKeys[j]]) {
                                    toVerify[dfKeys[j]].n = contracts[i].n
                                    toVerify[dfKeys[j]].b = contracts[i].df[dfKeys[j]]
                                    toVerify[dfKeys[j]].i = i
                                    toVerify[dfKeys[j]].v = 0
                                    toVerify[dfKeys[j]].npid = {}
                                    for (var node in toVerify[dfKeys[j]].n) {
                                        toVerify[dfKeys[j]].npid[node] = j.length //?
                                        k.push([dfKeys[j], toVerify[dfKeys[j]].n[node]])
                                        promises.push(getPathObj(['service', 'IPFS', toVerify[dfKeys[j]].n[node]]))
                                    }
                                    //this.Pending[block % 200] = toVerify
                                }
                            }
                        }
                        Promise.all(promises).then(peerIDs => {
                          for (var i = 0; i < peerIDs.length; i++) {
                              this.Pending[`${block % 200}`][k[i][0]] = {}
                              k[i].push(peerIDs[i])
                              this.validate(k[i][0], k[i][1], k[i][2], prand, block)
                          }
                        })
                    })
                  })
                })  
              })
          }
      })
  },
  getRange(prand, account, val, stats) {
      const cutoff = stats.val_threshold || 1
      var total = 0
      var n = Object.keys(val)
      for (var i = 0; i < n.length; i++) {
          if (val[n[i]] >= cutoff) total += cutoff * 2
          else total += val[n] || 1
      }
      const gte = this.getPrand58(account, prand)
      const range = parseInt(((val[account] >= cutoff ? cutoff * 2 : val[account]||1) / total) * (stats.total_files * parseInt(stats.vals_target * 10000) / 288) * 7427658739)
      const lte = Base58.fromNumber(Base58.toNumber(gte) + range)
      return [gte, lte]
  },
  getPrand58(account, prand) {
      p = prand.split('')
      a = account.split('')
      r = 1n
      for (var i = 0; i < p.length; i++) {
          r = r * BigInt(1 + parseInt(p[i], 16))
      }
      for (var i = 0; i < a.length; i++) {
          r = r * BigInt(1 + Base38.toNumber(a[i]))
      }

      return Base58.fromNumber(Number(r % 7427658739644928n))
  },
  validate: function (CID, Name, peerIDs, SALT, bn) {  
    console.log("PoA: ",CID, Name, peerIDs, SALT, bn)
    peerids = peerIDs.split(',')
    for (var i = 0; i < peerids.length; i++) {
        PA (Name, CID, peerids[i], SALT, bn)
    }
  },
  read: function (key) {
      return new Promise((res, rej) => {
          fetch(`http://localhost:3000/read?key=${key}`)
              .then(r => r.json())
              .then(json => res(json))
              .catch(e => {
                  console.log('Failed to read:', key)
                  rej(e)
              })
      })
  },
  write: function (key, value) {
      return new Promise((res, rej) => {
          fetch(`http://localhost:3000/write?key=${key}&value=${value}`)
              .then(r => r.json())
              .then(json => res(json))
              .catch(e => {
                  console.log('Failed to read:', key)
                  rej(e)
              })
      })
  }

}
exports.PoA = PoA;

function PA (Name, CID, peerid, SALT, bn){
  var socket = new WebSocketClient();
  socket.on('connect', (connection) => {
    setTimeout(() => {
      connection.close()
      console.log("Timeout:", CID)}, 240000)
    console.log({ Name, CID, peerid, SALT })
    connection.send(JSON.stringify({ Name, CID, peerid, SALT }));
    connection.on('message', (event) => {
      console.log(event)
      const data = event.utf8Data ? JSON.parse(event.utf8Data) : {}
      console.log({data})
      //const stepText = document.querySelectorAll('.step-text');
      if (data.Status === 'Connecting to Peer') {
          if (config.mode == 'verbose') console.log('Connecting to Peer')
      } else if (data.Status === 'IpfsPeerIDError') {
        connection.close()
          if (config.mode == 'verbose') console.log('Error: Invalid Peer ID')
      } else if (data.Status === 'RequestingProof') {
        if (config.mode == 'verbose') console.log('RequestingProof')
      } else if (data.Status === 'Connection Error') {
        connection.close()
          if (config.mode == 'verbose') console.log('Error: Connection Error')
      } else if (data.Status === 'Waiting Proof') {
          if (config.mode == 'verbose') console.log('Waiting Proof', { data })
      } else if (data.Status === "Validating") {
          if (config.mode == 'verbose') console.log('Validating', { data })
      } else if (data.Status === "Validated") {
          if (config.mode == 'verbose') console.log('Validated', { data })
      } else if (data.Status === "Validating Proof") {
          if (config.mode == 'verbose') console.log('Validating Proof', { data })
      } else if (data.Status === "Valid") {
          if (config.mode == 'verbose') console.log('Proof Validated', { data })
          if (PoA.Pending[`${bn % 200}`][CID])PoA.Pending[`${bn % 200}`][CID][Name] = data
          connection.close()
      } else if (data.Status === "Proof Invalid") {
          if (config.mode == 'verbose') console.log('Proof Invalid', { data })
          connection.close()
      }
  })
  })
  socket.on('connectFailed', function(error) {
      console.log('Connect Error: ' + error.toString());
  });
  socket.connect(`${config.poav_address}/validate`)
}

exports.poa = function (block, prand, stats) {
  return new Promise ((res, rej) => {
    let ops = [{
      type: 'put',
      path: ['rand', `${block % 200}`],
      data: prand
    }]
    // build rando value from base38 account name and base 16 prand: convert random value to base 58: set range according to val votes
    PoA.Validate(block, prand, stats)
    store.batch(ops, [res, rej, 1])
  })
}

exports.val_reg = function (json, from, active, pc) {
  var mskey, brandOK = false
  if (json.mskey && json.mschallenge) {
    try {
      const verifyKey = decode(config.msPriMemo, json.mschallenge);
      const nowhammies = encode(config.msPriMemo, config.msPubMemo, verifyKey);
      const isValid = encode(config.msPriMemo, json.mskey, "#try");
      if (
        typeof isValid == "string" &&
        verifyKey == `#${json.mskey}` &&
        nowhammies != json.mschallenge
      )
        mskey = json.mskey;
    } catch (e) {}
  }
  if(typeof json.brand == 'number')brandOK = true
  if (brandOK && mskey && json.domain && typeof json.domain === "string") {
    //store.get(["markets", "v", from], function (e, a) {
    let Pvnode = getPathObj(["markets", "v", from]);
    let Pbal = getPathNum(["balances", from]);
    let Pstats = getPathObj(["stats"]);
    Promise.all([Pvnode, Pbal, Pstats]).then((mem) => {
      let ops = [];
      if (isEmpty(mem[0]) && json.brand >= mem[2].vnode.min && json.brand >= mem[1]) {
        ops.push({ type: "put", path: ["balances", from], data: mem[1] - parseInt(json.brand) });
        data = {
          domain: json.domain || "localhost",
          self: from,
          strikes: 0,
          branded: parseInt(json.brand),
          riding: {},
          contracts: {},
          mskey,
        };
        ops = [
          {
            type: "put",
            path: ["markets", "v", from],
            data,
          },
        ];
        const msg = `@${from}| has branded ${json.brand} into their validator node at ${json.domain}`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      } else {
        ops = [
          {
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: `@${from}| insufficient LARYNX to brand a validator node.`,
          },
        ];
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      }
    });
  } else {
    ops = [
      {
        type: "put",
        path: ["feed", `${json.block_num}:${json.transaction_id}`],
        data: `@${from}| sent and invalid validator add operation`,
      },
    ];
    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
    store.batch(ops, pc);
  }
};



/* explanation:
Validator Nodes are the nodes that are used to validate IPFS and assist in running the network.
To start one an amount of LARYNX needs to be ~burned into the validator node. This is called a brand.
The minimum amount is set by the SPK network governance. Other key items here are: domain, mskey, and mschallenge.
The mschallenge is only a dummy check to ensure a key pair was entered into the config file. It can't prevent a bad key from being carefully inserted.
The mskey is used to send and receive encrypted memos. These memos will help SPK network clients to send and receive other information by building secure channels.
These secure channels can be found at the API provided at the domain.
Riding is powered larynx that earns less than a brand. These might lower fees for the delegators, as the lower reward is split with the validitor.

contracts are expirationBlock:QmHash

The Job:
0. Establish a channel to prevent spam
1. Receive data to be uploaded to IPFS
2. Hold data long enough for IPFS nodes to hold copies / Pin Management
4. Use pseudo-random number to probe IPFS hashes for availability.
5. Ask for IPFS hash from IPFS nodes that should have the data as well as public nodes or other nodes of the network.
6. Verify hash via byte counts and re-add.
7. Report the order in which the correct files are received.
8. Get rewarded in SPK / Broca Tokens along with the IPFS nodes for their efforts.


ToDo:
stats.vnode.min

validators.total
.nodes[node].rl //range low
.nodes[node].rh //range high
.nodes[node].b //brand
.nodes[node].d //delegate
.nodes[node].v //spk votes?

*/

exports.val_add = function (json, from, active, pc) { //add Larynx to brand
  var Pvnode = getPathObj(["markets", "v", from]),
    Pbal = getPathNum(["balances", from]),
    Pstats = getPathObj(["stats"]);
  Promise.all([Pvnode, Pbal, Pstats]).then((mem) => {
    var Error = ''
    if(isEmpty(mem[0]))Error += 'No validator node found. '
    if(mem[1] < parseInt(json.brand))Error += 'Insufficient LARYNX to add to validator node. '
    if(!Error){
      let data = {
        ...mem[0],
      };
      data.branded += parseInt(json.brand);
      data.branded += parseInt(json.brand);
      let ops = [
        {
          type: "put",
          path: ["balances", from],
          data: mem[1] - parseInt(json.brand),
        },
        {
          type: "put",
          path: ["markets", "v", from],
          data,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    } else {
      ops = [
        {
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: `@${from}| ${Error}`,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    }
  })
}

exports.val_bytes_flag = function (json, from, active, pc) {
  const Pcon = getPathObj(["f", json.file]),
    Psnodes = getPathObj(["markets", "s"]);
  Promise.all([Pcon, Psnodes]).then((mem) => {
    var contract = mem[0],
      snodes = mem[1];
    if(snodes[from].id == contract.a || snodes[from].id == contract.b || snodes[from].id == contract.c){
      if(contract.b != json.bytes){
        contract[snodes[from].id] = json.bytes
        contract.sd = 1 //size dispute
      }
      let ops = [
        {
          type: "put",
          path: ["f", json.file],
          data: contract
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      chronAssign(json.block_num + 500, {
        op: "sd",
        f: json.file
      }).then(empty => {
        store.batch(ops, pc);
      })
    } else {
      pc[0](pc[2]);
    }
  })
}

exports.val_bytes = function (json, from, active, pc) { //update domain or mskey
  const Pcon = getPathObj(["f", json.file])
  Promise.all([Pcon]).then((mem) => {
    var contract = mem[0]
    const rangeCheck = (Base58.toNumber(json.file.substr(14, 20)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
    if (
        rangeCheck >= validators.nodes[from].rl &&
        rangeCheck <= validators.nodes[from].rh
      ) {
      let ops = [
        {
          type: "put",
          path: ["valCheck", `${json.block}:${json.file}`],
          data: check,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    } else {
      pc[0](pc[2]);
    }
  });
}

exports.val_bundle = function (json, from, active, pc) { //IPFS bundle offered from validator to IPFS storage
  var Pvnode = getPathObj(["markets", "v", from]),
    Psnodes = getPathObj(["markets", "s"])

  Promise.all([Pvnode, Psnodes]).then((mem) => {
    var vnode = mem[0],
      snodes = mem[1],
      ops = [],
      promises = []
    if(from == vnode.self && json.bundle.length){
      var i = 0
      makeStorageContract(i, snodes, json, from, [])
      .then(r=>{
        ops = r
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      })
    } else {
      pc[0](pc[2]);
    }
  });
}

function makeStorageContract(i, snodes, json, from, ops){
  return new Promise((resolve, reject) => {
    var data = {
      s: json.bundle[i].s, //size
      v: from,
    }
    if (snodes[json.bundle[i].a].self == json.bundle[i].a)data.a = snodes[json.bundle[i].a].id
    if (snodes[json.bundle[i].b].self == json.bundle[i].b)data.b = snodes[json.bundle[i].b].id;
    if (snodes[json.bundle[i].c].self == json.bundle[i].c)data.c = snodes[json.bundle[i].c].id;
    chronAssign(json.block_num + 2592000, { //90 days
      op: "rm",
      f: json.bundle[i].f,
    })
    .then(r=>{
      data.x = r
      ops.push({ type: "put", path: ["f", json.bundle[i].f], data })
      if(json.bundles.length > i){
        i++
        makeStorageContract(i, snodes, json, from, ops)
      } else {
        resolve(ops)
      }
    })
  })
}

exports.val_report = function (json, from, active, pc) { //periodic report of ping times of items.
  const Pcon = getPathObj(['f', json.file]),
    Pnonce = getPathObj(['nonce', `${json.block % 1000}`]),
    Pcheck = getPathObj(['valCheck', `${json.block}:${json.file}`]),
    Pvalidators = getPathObj(["validators"])
  var fileCheck = false, nodeCheck = true

  Promise.all([Pcon, Pnonce, Pcheck, Pvalidators]).then((mem) => {
    var contract = mem[0],
      nonce = mem[1],
      check = mem[2],
      validators = mem[3]
    if (
      Base58.toNumber(json.file.substr(2, 6)) ==
      JSON.parseInt(nonce.substr(0, 8), 16) % Math.pow(58, 4)
    )
      fileCheck = true;
    const rangeCheck = (Base58.toNumber(json.file.substr(14, 20)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
      if (
        rangeCheck >= validators.nodes[from].rl &&
        rangeCheck <= validators.nodes[from].rh
      )nodeCheck = true
    if (contract.b && fileCheck && nodeCheck) {
      check.v = {
        z: json.block_num, //block number
        v: from,
      };
      if(json.a > 0 && json.a <= 5)check.a = parseInt(json.a); //ordered pass
      if(json.b > 0 && json.b <= 4)check.b = parseInt(json.b);
      if(json.c > 0 && json.c <= 3)check.c = parseInt(json.c);
      if(json.d > 0 && json.d <= 2)check.d = parseInt(json.d);
      if(json.e > 0 && json.e <= 1)check.e = parseInt(json.e);
      if(json.f > 0 && json.f <= 5)check.f = parseInt(json.f); //failures
      if(json.g > 0 && json.g <= 4)check.g = parseInt(json.g);
      if(json.h > 0 && json.h <= 3)check.h = parseInt(json.h);
      if(json.i > 0 && json.i <= 2)check.i = parseInt(json.i);
      if(json.j > 0 && json.j <= 1)check.j = parseInt(json.j);
      chronAssign(json.block_num + 100, { //5 minutes, reward storage
       op: "rs",
        f: json.file,
        b: json.block
      }).then(r=>{
        let ops = [
          {
            type: "put",
            path: ["valCheck", `${json.block}:${json.file}`],
            data: check,
          },
        ];
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      })
    } else {
      pc[0](pc[2]);
    }
  });
}



exports.val_check = function (json, from, active, pc) { //second-check of IPFS hash isAvail
  const Pcon = getPathObj(["f", json.file]),
    Pnonce = getPathObj(["nonce", `${json.block % 1000}`]),
    Pvalidators = getPathObj(["validators"]),
    Pcheck = getPathObj(["valCheck", `${json.block}:${json.file}`]);
  var fileCheck = false,
    nodeCheck = 0;

  Promise.all([Pcon, Pnonce, Pvalidators, Pcheck]).then((mem) => {
    var contract = mem[0],
      nonce = mem[1],
      validators = mem[2],
      check = mem[3],
      rangeCheck = (Base58.toNumber(json.file.substr(7, 13)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
    if (
      Base58.toNumber(json.file.substr(2, 6)) ==
      JSON.parseInt(nonce.substr(0, 8), 16) % Math.pow(58, 4)
    )
      fileCheck = true;
    if (
      rangeCheck >= validators.nodes[from].rl &&
      rangeCheck <= validators.nodes[from].rh
    ) {
      nodeCheck = 1;
    } else {
      rangeCheck = (Base58.toNumber(json.file.substr(14, 20)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
      if (
        rangeCheck >= validators.nodes[from].rl &&
        rangeCheck <= validators.nodes[from].rh
      ) {
        nodeCheck = 2;
      } else {
        rangeCheck = ( Base58.toNumber(json.file.substr(21, 27)) * parseInt(nonce.substr(0,6), 16)) % validators.total;
        if (
          rangeCheck >= validators.nodes[from].rl &&
          rangeCheck <= validators.nodes[from].rh
        )
          nodeCheck = 3;
      }
    }
    if (contract.b && fileCheck && nodeCheck) {
      check[nodeCheck] = {
        b: json.block_num, //block number
        a: json.isAvail ? 1 : 0, //availability
        f: from,
      };

      let ops = [
        {
          type: "put",
          path: ["valCheck", `${json.block}:${json.file}`],
          data: check,
        },
      ];
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    } else {
      pc[0](pc[2]);
    }
  });
}

//power up
//delegate

//spk transfer
// spk dex?
//spk power up
//spk vote
