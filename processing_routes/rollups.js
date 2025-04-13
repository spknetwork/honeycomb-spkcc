const jsdiff = require('diff')
const config = require("./../config");
const { store } = require("./../index");
const hiveTx = require("hive-tx");
const { sha256 } = require("hive-tx/helpers/crypto");
const HR = require("./index")
const base64url = require("base64url");
const { getPathObj } = require("../getPathObj");
const { chronAssign, broca_calc } = require("./../lil_ops")
const { postToDiscord } = require('./../discord');
const { Base64 } = require("../helpers");
const { put } = require("request");

const stringify = require('json-stable-stringify');

/*{
rollups: ['j.w.ts','j.w.ts']
}*/

// exports.rollup = (json, from, active, pc) => {
//     var inputs = json.rollups
//     var verified_inputs = []
//     var requirements = [], promises = []
//     for (var i = 0 ; i < inputs.length; i++){
//         var operation = {}
//         operation.array = inputs[i].split(".");
//         if (typeof inputs[i] == "string" && operation.array.length == 3) {
//             operation.header = JSON.parse(base64url.decode(operation.array[0]))
//             operation.payload = JSON.parse(
//               base64url.decode(operation.array[1])
//             );
//             operation.sig = operation.array[2];
//             if (
//               operation.header.from &&
//               config.rollup_ops.indexOf(operation.header.op) >= 0
//             ) {
//               requirements.push([i, ["authorities", from]]);
//               operation.index = i;
//               verified_inputs.push(operation);
//             }
//         }
//     }
//     if (requirements.length)
//       for (var i = 0; i < requirements.length; i++) {
//         promises.push(getPathObj(requirements[i][1]));
//         Promise.all(promises).then((pubKeys) => {
//           for (var i = 0; i < requirements.length; i++) {
//             if (typeof pubKeys[i] == "string") requirements[i].push(pubKeys[i]);
//           }
//           for (var i = 0; i < verified_inputs.length; i++){
//             if(requirements[verified_inputs[i].index][2]){
//                 verified_inputs[i].pubKey = requirements[verified_inputs[i].index][2];
//                 const digest = sha256(`${verified_inputs[i].array[0]}.${verified_inputs[i].array[1]}`);
//                 const publicKey = hiveTx.PublicKey.from(
//                   verified_inputs[i].pubKey
//                 );
//                 verified_inputs[i].authorized = publicKey.verify(
//                   digest,
//                   hiveTx.Signature.from(verified_inputs[i].array[2])
//                 );
//             } else {
//                 verified_inputs.splice(i,1)
//                 i--
//             }
//           }
//           var opChain = []
//           for (var i = 0; i < verified_inputs.length; i ++){
//             if(verified_inputs[i].authorized){
//                 var payload = verified_inputs[i].payload;
//                 payload.block_num = json.block_num
//                 payload.transaction_id = json.transaction_id + ":" + i
//                 payload.transaction_num = json.transaction_num + ":" + i;
//                 opChain.push([verified_inputs[i].header.op, verified_inputs[i].header.from, payload])
//             }
//           }
//           doOps(opChain).then(r => pc[0](pc[2]))
//         });
//       } else {
//       pc[0](pc[2]);
//     }
// };

// function doOps(opChain){
//     return new Promise((resolve, reject) => {
//         if(opChain.length){
//             const currentOp = opChain.shift()
//             doOp(currentOp, opChain).then(pc=>{
//                 if (pc.length) doOps(pc)
//                 else resolve('DONE')
//             })
//         } else {
//             resolve('DONE')
//         }
//     })
// }

// function doOp(op, pc) {
//     return new Promise((resolve, reject) => {
//         HR[op[0]](op[1], op[2], true, [
//         resolve,
//         reject,
//         pc,
//         ]);
//     });
// }

function verifySig(msg, sig, key) {
  var verify = false
  try {
    const { sha256 } = require("hive-tx/helpers/crypto");
    const signature = hiveTx.Signature.from(sig)
    const message = sha256(msg);
    const publicKey = hiveTx.PublicKey.from(key);
    verify = publicKey.verify(message, signature)
    if (verify) return true
    else return false
  } catch (e) {
    return false
  }
}

exports.register_authority = (json, from, active, pc) => {
  if (
    json.pubKey &&
    typeof json.pubKey == "string" &&
    json.pubKey.substr(0, 3) == "STM" && json.pubKey.length == 53) {
    var ops = [{ type: "put", path: ["authorities", from], data: json.pubKey }, {
      type: "put",
      path: ["feed", `${json.block_num}:${json.transaction_id}`],
      data: `${from} registered a public key.`,
    }];
    if (config.hookurl || config.status) postToDiscord(`${from} registered a public key.`, `${json.block_num}:${json.transaction_id}`);
    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
    store.batch(ops, pc);
  } else {
    pc[0](pc[2]);
  }
};

/*
json => 
from => 3spk or account with broca
to => person who can upload a file
broker => account that can recieve an upload
broca => amount of broca to place into contract
contract => smart from day 1
*/

/*
POA contract

// logic[ == , != , < , <= , > , >=, && , || , ! , + , concat , -, *, /, sqrt, pow, ]
// O[ valid sig]
// i[inputs (a-zA-z)]
[
  [S, F, T, B, $B, MemAlloc[0,0,0,0,0,0], PartyAlloc[0,0,0], [instructions]]
  
  [Total, accounts ...], [0,0,0,0,0,0,0,0]
]

inputs: auth, logic steps, matrix only
[CID, bytes] [FaSigned(`F:CID`). TaSigned(`T:CID`), write CID, write Bytes, StateUpdate @2] 



update: 1 (matches mem[0] the state), [CID, sig.from, sig.to]
update: 2 , [sig.theirs, IPFSID]
*/

exports.channel_open = (json, from, active, pc) => {
  if (json.to && json.broker) { //make this accept arrays of ops
    var Pbroca = getPathObj(["broca", from]);
    var Ppow = getPathObj(["bpow", from]);
    var Pproffer = getPathObj(['proffer', json.to, from, json.contract])
    var Pstats = getPathObj(["stats"])
    var PauthB = getPathObj(["authorities", json.broker])
    var PbrokerService = getPathObj(["services", json.broker, 'IPFS'])
    var PauthT = getPathObj(["authorities", json.to]);
    var PauthF = getPathObj(["authorities", from]);
    var Ptemplate = getPathObj(["template", json.contract]);
    Promise.all([Pbroca, Pproffer, Pstats, PauthF, PauthT, PauthB, Ptemplate, Ppow, PbrokerService]).then(mem => {
      var broca = mem[0],
        proffer = mem[1],
        stats = mem[2],
        authF = mem[3],
        authT = mem[4],
        authB = mem[5],
        template = mem[6],
        pow = mem[7],
        broker = mem[8]
      ops = [],
        err = '' //no log no broca?
      if (typeof broca != "string") broca = '0,0'
      console.log(broca, pow, stats, json.block_num)
      brocaString = broca_calc(broca, pow, stats, json.block_num),
        broca = parseInt(broca.split(',')[0])
      console.log({ broca })
      if (typeof template.i != "string") err += `Contract doesn't exist.`
      if (typeof authF != 'string') err += `@${from} hasn't registered a public key. `
      if (typeof authT != "string") err += `@${json.to} hasn't registered a public key. `;
      if (typeof authB != "string") err += `@${json.broker} hasn't registered a public key. `;
      if (!Object.keys(broker).length) err += `@${json.broker} IPFS service error. `
      if (proffer.e) err += `This channel exists: ${proffer.e.split(':')[1]} `
      if (json.broca > broca || json.broca < stats.channel_min) err += `@${from} doesn't have enough BROCA to build a channel. `;
      if (json.slots && template.s != json?.slots.split(',').length) err += `Slots mismatch.`;//checker for slots against contract... enforcement of benificaries
      if (!err) {
        proffer.i = `${from}:${json.contract}:${json.block_num}-${json.transaction_id}`
        proffer.t = json.to //to
        proffer.f = from //from
        proffer.b = json.broker //broker
        proffer.r = parseInt(json.broca) //resource credit
        if (json.p > 3 && json.p <= 10) { //power of decentralization (full payout slots)
          proffer.p = json.p
        } else proffer.p = 3
        proffer.a = parseInt(
          (3 * json.broca * stats.channel_bytes) / proffer.p
        );
        proffer.c = 1 //status codes 0: exists; 1: signed file(s); 2: 
        if (json.slots) proffer.s = json.slots
        broca -= parseInt(json.broca);
        chronAssign(parseInt(json.block_num + 28800), {
          block: parseInt(json.block_num + 28800),
          op: 'channel_check',
          from,
          to: json.to,
          c: json.contract,
          e: 1
        }).then(exe_path => {
          proffer.e = exe_path

          ops.push({
            type: "put",
            path: ["broca", from],
            data: `${broca},${brocaString.split(',')[1]}`,
          });
          const msg = `@${json.to} authorized to upload ${proffer.a} bytes to @${json.broker} by @${from} for ${json.broca} BROCA`;
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ['proffer', json.to, from, json.contract],
            data: proffer,
          });
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          console.log(ops)
          store.batch(ops, pc);
        })
      } else {
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: `${err}`,
        });
        if (config.hookurl || config.status)
          postToDiscord(`${err}`, `${json.block_num}:${json.transaction_id}`);
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        console.log(ops)
        store.batch(ops, pc);
      }
    })
  } else {
    pc[0](pc[2]);
  }
};

// ensure no IPFS cid collisions


// exports.channel_update = (json, from, active, pc) => {
//   console.log(json)
//   if (active && json.fo && json.f && json.id && json.co == from) {
//     var Pbroca = getPathObj(["broca", json.f]);
//     var Ppow = getPathObj(["spow", json.f]);
//     var Pproffer = getPathObj(['proffer', json.fo, json.f, json.id.split(':')[1]])
//     var Pstats = getPathObj(["stats"])
//     var PauthB = getPathObj(["authorities", json.co])
//     var PauthT = getPathObj(["authorities", json.fo]);
//     var PauthF = getPathObj(["authorities", json.f]);
//     var Ptemplate = getPathObj(["template", json.id.split(':')[1]]);
//     Promise.all([Pbroca, Pproffer, Pstats, PauthF, PauthT, PauthB, Ptemplate, Ppow]).then(mem => {
//       var broca = mem[0],
//         proffer = mem[1],
//         stats = mem[2],
//         authF = mem[3],
//         authT = mem[4],
//         authB = mem[5],
//         template = mem[6],
//         spow = mem[7],
//         ops = [],
//         err = '' //no log no broca?
//       console.log({ proffer })
//       if (proffer.b != json.co) err += `Query with incorect broker. `
//       if (typeof authF != 'string') err += `Misplaced AuthorityF. `
//       if (typeof authT != "string") err += `Misplaced AuthorityT. `;
//       if (typeof authB != "string") err += `Unauthorized. `;
//       if (!proffer.c) err += `This channel doesn't exists. `
//       if (!verifySig(`${json.fo}:${json.id},${json.c}`, json.sig, authT)) err += 'Unsigned.'
//       if (!err) {
//         var total = 0
//         proffer.c++
//         proffer.n = { // nodes to store
//           [`1`]: from
//         }
//         if (json.m && typeof json.m == 'string'){
//           proffer.m = json.m //memo
//           proffer.m = stringify(proffer.m)
//         }
//         proffer.nt = "1"
//         var cids = json.c.split(',')
//         var proms = []
//         proffer.df = {} //distributed files
//         for (var i = 0; i < cids.length; i++) {
//           if (cids[i]) {
//             const rev = cids[i].split("").reverse().join("")
//             ops.push({
//               type: "put",
//               path: ["IPFS", `${rev}`],
//               data: `${json.fo},${json.id}`,
//             })
//             proms.push(getPathObj(["IPFS", `${rev}`]))
//             proffer.df[cids[i]] = parseInt(json.s.split(',')[i])
//           }
//         }
//         ops.push({
//           type: "del",
//           path: ["chrono", `${proffer.e}`]
//         });
//         Promise.all(proms).then(ips => {
//           var num = 0
//           for (var i = 0; i < ips.length; i++) {
//             if (typeof ips[i] == "string") {
//               coll = true
//               delete proffer.df[cids[i]]
//             } else {
//               num++
//               console.log(parseInt(json.s.split(',')[i]), json.s.split(',')[i])
//               if (json.s.split(',')[i] == 'undefined') { pc[0](pc[2]); return } //files must have sizes
//               total += parseInt(json.s.split(',')[i] == 'undefined' ? 0 : json.s.split(',')[i])
//             }
//           }
//           const broca_refund = proffer.r - parseInt((total / proffer.a) * proffer.r)
//           proffer.r -= broca_refund
//           proffer.u = total
//           if (!num) {
//             err = `${json.id}-No Files`
//             ops = [{
//               type: "put",
//               path: ["feed", `${json.block_num}:${json.transaction_id}`],
//               data: err,
//             }]
//             if (config.hookurl || config.status)
//               postToDiscord(err, `${json.block_num}:${json.transaction_id}`);
//             if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
//             store.batch(ops, pc);
//           } else {
//             stats.total_bytes += total
//             stats.total_files += num
//             ops.push({
//               type: "put",
//               path: ["stats"],
//               data: stats
//             });
//             ops.push({
//               type: "put",
//               path: ["broca", json.f],
//               data: broca_calc(broca, spow, stats, json.block_num, broca_refund)
//             });
//             ops.push({
//               type: "put",
//               path: ["feed", `${json.block_num}:${json.transaction_id}`],
//               data: json.id + " bundled",
//             });
//             if (template[`${proffer.c}`].a == 'BEN') {
//               chronAssign(parseInt(json.block_num + template[`${proffer.c}`].t), {
//                 block: parseInt(json.block_num + template[`${proffer.c}`].t),
//                 op: 'channel_check',
//                 from: json.f,
//                 to: json.fo,
//                 c: json.id.split(':')[1],
//                 e: proffer.c
//               }).then(exe_path => {
//                 proffer.e = exe_path
//                 proffer.exp = json.block_num + template[`${proffer.c}`].t
//                 ops.push({
//                   type: "put",
//                   path: ['proffer', json.fo, json.f, json.id.split(':')[1]],
//                   data: proffer
//                 });
//                 ops.push({
//                   type: "put",
//                   path: ['ben', json.fo, proffer.s.split(',')[0]],
//                   data: proffer.i
//                 });
//                 ops.push({
//                   type: "put",
//                   path: ["contract", json.fo, json.id],
//                   data: proffer,
//                 })
//                 ops.push({
//                   type: "put",
//                   path: ["cPointers", json.id],
//                   data: json.fo
//                 })
//                 if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
//                 console.log(ops)
//                 store.batch(ops, pc);
//               })
//             } else {
//               chronAssign(parseInt(json.block_num + template[`${proffer.c}`].t), {
//                 block: parseInt(json.block_num + template[`${proffer.c}`].t),
//                 op: 'contract_close',
//                 fo: json.fo,
//                 id: json.id
//               }).then(exe_path => {
//                 proffer.e = exe_path
//                 proffer.c = 3
//                 ops.push({
//                   type: "del",
//                   path: ['proffer', json.fo, json.f, json.id.split(':')[1]]
//                 });
//                 ops.push({
//                   type: "put",
//                   path: ["contract", json.fo, json.id],
//                   data: proffer,
//                 })
//                 ops.push({
//                   type: "put",
//                   path: ["cPointers", json.id],
//                   data: json.fo
//                 })
//                 if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
//                 console.log(ops)
//                 store.batch(ops, pc);
//               })
//             }
//           }
//         })
//       } else {
//         ops.push({
//           type: "put",
//           path: ["feed", `${json.block_num}:${json.transaction_id}`],
//           data: !proffer.s ? '404' : err,
//         });
//         if (config.hookurl || config.status)
//           postToDiscord(err, `${json.block_num}:${json.transaction_id}`);
//         if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
//         store.batch(ops, pc);
//       }
//     })
//       .catch(e => console.log(e))
//   } else {
//     pc[0](pc[2]);
//   }
// };

exports.channel_update = (json, from, active, pc) => {

  // Check if the JSON indicates a chunked update
  if (active && json.fo && json.f && json.id && json.co === from) {
    if (json.chunk_data) {
      Pproffer = getPathObj(['proffer', json.fo, json.f, json.id.split(':')[1]]);

      // Handle chunked update
      const chunk_id = json.chunk_id;
      const total_chunks = json.total_chunks;
      const chunk_data = json.chunk_data;

      // Retrieve or initialize partial update storage
      var Ppartial = getPathObj(["partial_updates", json.id.split(':')[2]]);

      Promise.all([Pproffer, Ppartial]).then(mem => {
        let proffer = mem[0];
        let partial = mem[1];
        let ops = [];

        // If no partial update exists, initialize it
        if (!partial.total_chunks) {
          partial = {
            total_chunks: total_chunks,
            from: from,
            active: active,
            chunks: {}
          };
        } else {
          // Validate permission
          if (!proffer || proffer.b !== json.co) {
            console.log("Error: Update with incorrect broker");
            pc[0](pc[2]);
            return;
          }
          // Validate consistency
          if (partial.total_chunks !== total_chunks) {
            console.log("Error: Inconsistent total_chunks", partial.total_chunks, total_chunks);
            pc[0](pc[2]);
            return;
          }
        }

        // Store the current chunk
        partial.chunks[chunk_id] = chunk_data;

        // Check if all chunks are received
        const received_chunks = Object.keys(partial.chunks).length;
        if (received_chunks === total_chunks) {
          // Assemble the complete JSON string
          let complete_data = "";
          for (let i = 1; i <= total_chunks; i++) {
            if (!partial.chunks[i]) {
              console.log(`Error: Missing chunk ${i}`);
              pc[0](pc[2]);
              return;
            }
            complete_data += partial.chunks[i];
          }

          // Parse the assembled JSON
          let complete_json;
          try {
            complete_json = JSON.parse(complete_data);

          } catch (e) {
            console.log("Error parsing complete JSON:", e);
            pc[0](pc[2]);
            return;
          }
          complete_json.block_num = json.block_num
          // Process the complete update and clean up
          process_complete_update(complete_json, from, active).then(additional_ops => {
            ops = additional_ops.concat({
              type: "del",
              path: ["partial_updates", json.id.split(':')[2]]
            });
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            store.batch(ops, pc);
          }).catch(e => {
            console.log("Error processing update:", e);
            pc[0](pc[2]);
          });
        } else {
          // Store the partial update and wait for more chunks
          ops.push({
            type: "put",
            path: ["partial_updates", json.id.split(':')[2]],
            data: partial
          });
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        }
      }).catch(e => {
        console.log("Error accessing partial update:", e);
        pc[0](pc[2]);
      });
    } else {
      // Handle single-transaction update
      process_complete_update(json, from, active).then(ops => {
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc);
      }).catch(e => {
        console.log("Error processing single update:", e);
        pc[0](pc[2]);
      });
    }
  }
}

function process_complete_update(json, from, active) {
  return new Promise((resolve, reject) => {
    if (active && json.fo && json.f && json.id && json.co === from) {
      var Pbroca = getPathObj(["broca", json.f]);
      var Ppow = getPathObj(["bpow", json.f]);
      var Pproffer = getPathObj(['proffer', json.fo, json.f, json.id.split(':')[1]]);
      var Pstats = getPathObj(["stats"]);
      var PauthB = getPathObj(["authorities", json.co]);
      var PauthT = getPathObj(["authorities", json.fo]);
      var PauthF = getPathObj(["authorities", json.f]);
      var Ptemplate = getPathObj(["template", json.id.split(':')[1]]);

      Promise.all([Pbroca, Pproffer, Pstats, PauthF, PauthT, PauthB, Ptemplate, Ppow]).then(mem => {
        var broca = mem[0],
          proffer = mem[1],
          stats = mem[2],
          authF = mem[3],
          authT = mem[4],
          authB = mem[5],
          template = mem[6],
          bpow = mem[7],
          ops = [],
          err = '';

        if (proffer.b !== json.co) err += `Query with incorrect broker. `;
        if (typeof authF !== 'string') err += `Misplaced AuthorityF. `;
        if (typeof authT !== "string") err += `Misplaced AuthorityT. `;
        if (typeof authB !== "string") err += `Unauthorized. `;
        if (!proffer.c) err += `This channel doesn't exist. `;
        if (!verifySig(`${json.fo}:${json.id},${json.c}`, json.sig, authT)) err += 'Unsigned.';

        if (!err) {
          var total = 0;
          proffer.c++;
          proffer.n = { "1": from };
          if (json.m && typeof json.m === 'string') {
            proffer.m = json.m;
            proffer.m = stringify(proffer.m);
          }
          proffer.nt = "1";
          var cids = json.c.split(',');
          var proms = [];
          proffer.df = {};
          for (var i = 0; i < cids.length; i++) {
            if (cids[i]) {
              const rev = cids[i].split("").reverse().join("");
              ops.push({
                type: "put",
                path: ["IPFS", `${rev}`],
                data: `${json.fo},${json.id}`
              });
              proms.push(getPathObj(["IPFS", `${rev}`]));
              proffer.df[cids[i]] = parseInt(json.s.split(',')[i]);
            }
          }
          ops.push({
            type: "del",
            path: ["chrono", `${proffer.e}`]
          });
          Promise.all(proms).then(ips => {
            var num = 0;
            for (var i = 0; i < ips.length; i++) {
              if (typeof ips[i] === "string") {
                delete proffer.df[cids[i]];
              } else {
                num++;
                if (json.s.split(',')[i] === 'undefined') {
                  reject("Files must have sizes");
                  return;
                }
                total += parseInt(json.s.split(',')[i] || 0);
              }
            }
            const broca_refund = proffer.r - parseInt((total / proffer.a) * proffer.r);
            proffer.r -= broca_refund;
            proffer.u = total;

            if (!num) {
              err = `${json.id}-No Files`;
              ops = [{
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: err
              }];
              if (config.hookurl || config.status) {
                postToDiscord(err, `${json.block_num}:${json.transaction_id}`);
              }
              resolve(ops);
            } else {
              stats.total_bytes += total;
              stats.total_files += num;
              ops.push({
                type: "put",
                path: ["stats"],
                data: stats
              });
              ops.push({
                type: "put",
                path: ["broca", json.f],
                data: broca_calc(broca, bpow, stats, json.block_num, broca_refund)
              });
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: json.id + " bundled"
              });
              if (template[`${proffer.c}`].a === 'BEN') {
                chronAssign(parseInt(json.block_num + template[`${proffer.c}`].t), {
                  block: parseInt(json.block_num + template[`${proffer.c}`].t),
                  op: 'channel_check',
                  from: json.f,
                  to: json.fo,
                  c: json.id.split(':')[1],
                  e: proffer.c
                }).then(exe_path => {
                  proffer.e = exe_path;
                  proffer.exp = json.block_num + template[`${proffer.c}`].t;
                  ops.push({
                    type: "put",
                    path: ['proffer', json.fo, json.f, json.id.split(':')[1]],
                    data: proffer
                  });
                  ops.push({
                    type: "put",
                    path: ['ben', json.fo, proffer.s.split(',')[0]],
                    data: proffer.i
                  });
                  ops.push({
                    type: "put",
                    path: ["contract", json.fo, json.id],
                    data: proffer
                  });
                  ops.push({
                    type: "put",
                    path: ["cPointers", json.id],
                    data: json.fo
                  });
                  resolve(ops);
                }).catch(reject);
              } else {
                chronAssign(parseInt(json.block_num + template[`${proffer.c}`].t), {
                  block: parseInt(json.block_num + template[`${proffer.c}`].t),
                  op: 'contract_close',
                  fo: json.fo,
                  id: json.id
                }).then(exe_path => {
                  proffer.e = exe_path;
                  proffer.c = 3;
                  ops.push({
                    type: "del",
                    path: ['proffer', json.fo, json.f, json.id.split(':')[1]]
                  });
                  ops.push({
                    type: "put",
                    path: ["contract", json.fo, json.id],
                    data: proffer
                  });
                  ops.push({
                    type: "put",
                    path: ["cPointers", json.id],
                    data: json.fo
                  });
                  resolve(ops);
                }).catch(reject);
              }
            }
          }).catch(reject);
        } else {
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: !proffer.s ? '404' : err
          });
          if (config.hookurl || config.status) {
            postToDiscord(err, `${json.block_num}:${json.transaction_id}`);
          }
          resolve(ops);
        }
      }).catch(reject);
    } else {
      resolve([]);
    }
  });
}

exports.extend = (json, from, active, pc) => {
  console.log('extend', active, json.broca, json.id, json.file_owner)
  if (active && json.broca && json.id && json.file_owner) {
    var Pbroca = getPathObj(["broca", from]);
    var Ppow = getPathObj(["bpow", from])
    var Pstats = getPathObj(["stats"])
    var Pcontract = getPathObj(["contract", json.file_owner, json.id])
    Promise.all([Pbroca, Pstats, Ppow, Pcontract]).then(mem => {
      var broca = mem[0],
        stats = mem[1],
        pow = mem[2],
        contract = mem[3],
        ops = [],
        err = '' //no log no broca?
      brocaString = broca_calc(broca, pow, stats, json.block_num),
        broca = parseInt(brocaString.split(',')[0])
      if (json.broca <= broca && contract.c == 3) {
        broca = broca - json.broca
        const exp_block = parseInt(contract.e.split(':')[0])
        if (json.from == contract.t && parseInt(json.power) > 0) {
          const broca_per_old_term = parseInt((contract.u * contract.p) / (stats.channel_bytes * 3)) || 1
          contract.p++
          const payUp = exp_block - json.block_num
          const broca_per_new_term = parseInt((contract.u * contract.p) / (stats.channel_bytes * 3)) || 1
          const debt = parseInt((broca_per_new_term - broca_per_old_term) * payUp)
          if (debt > json.broca) {
            const msg = `@${from} | Failed to increase decentralizition of ${json.id} due to lack of BROCA`
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: msg,
            });
            if (config.hookurl || config.status)
              postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            console.log(ops)
            store.batch(ops, pc);
          } else {
            json.broca -= debt
          }
        }

        // (28800 * 30) // term
        // remaining_time = exp_block - json.block_num
        const broca_per_term = parseInt((contract.u * contract.p) / (stats.channel_bytes * 3)) || 1
        const blocks_additional = parseInt((json.broca / broca_per_term) * 28800 * 30)
        chronAssign(parseInt(exp_block + blocks_additional), {
          block: parseInt(exp_block + blocks_additional),
          op: 'contract_close',
          fo: json.file_owner,
          id: json.id
        }).then(exe_path => {
          ops.push({
            type: 'del',
            path: ['chrono', contract.e]
          })
          contract.ex = contract.ex ? contract.ex + `,${from}:${json.broca}:${exp_block}-${exp_block + blocks_additional}` : `${from}:${contract.r}:${exp_block}-${exp_block + blocks_additional}`
          // clean extentions
          var extentions = contract.ex.split(',')
          var valid_exts = []
          for (var i = 0; i < extentions.length; i++) {
            if (extentions[i].split('-')[1] > json.block_num) valid_exts.push(extentions[i])
          }
          contract.ex = valid_exts.join(',')
          contract.e = exe_path
          ops.push({
            type: 'put',
            path: ["contract", json.file_owner, json.id],
            data: contract
          })
          ops.push({
            type: 'put',
            path: ["broca", from],
            data: `${broca},${brocaString.split(',')[1]}`
          })
          const msg = `@${from} | Extended ${json.id} by ${blocks_additional} blocks for ${json.broca} BROCA`
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          console.log(ops)
          store.batch(ops, pc);
        })
      } else {
        console.log('failOnContract', json.broca <= broca, contract.c == 3)
        pc[0](pc[2]);
      }
    })
  } else {
    pc[0](pc[2]);
  }
}

exports.store = (json, from, active, pc) => {
  console.log(json)
  if (json.items.length) {
    var promises = []
    for (var i = 0; i < json.items.length; i++) {
      console.log(json.items[i])
      promises.push(getPathObj(["cPointers", json.items[i]]))
    }
    promises.push(getPathObj(["services", from, 'IPFS']), getPathObj(["authorities", from]))
    Promise.all(promises).then(contractPointers => {
      const services = contractPointers[json.items.length]
      const PubKey = contractPointers[json.items.length + 1]
      console.log(PubKey, Object.keys(services).length)
      console.log(contractPointers)
      if (typeof PubKey == 'string' && Object.keys(services).length) { //ensure user has valid registered node to prevent spam
        promises = []
        for (var i = 0; i < json.items.length; i++) {
          if (typeof contractPointers[i] == "string") {
            promises.push(getPathObj(["contract", contractPointers[i], json.items[i]]))
          }
        }
        Promise.all(promises).then(contracts => {
          console.log(contracts)
          var ops = []
          var msg = `@${from} Stored|`
          for (var i = 0; i < contracts.length; i++) {
            const contract = contracts[i]
            if (contract.nt && Object.values(contract.n).indexOf(from) == -1) {
              const nt = Base64.fromNumber(Base64.toNumber(contract.nt) + 1)
              contract.n[nt] = from
              contract.nt = nt
              ops.push({
                type: "put",
                path: ["contract", contract.t, contract.i],
                data: contract,
              })
              msg += `${contract.i},`
            }
          }
          if (msg.charAt(msg.length - 1) != '|') {
            msg = msg.substring(0, msg.length - 1)
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: msg,
            });
            if (config.hookurl || config.status)
              postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          }
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc)
        })
      } else {
        pc[0](pc[2]);
      }
    })
  } else {
    pc[0](pc[2]);
  }
}

exports.remove = (json, from, active, pc) => { //inform stop storing items
  if (json.items.length) {
    var promises = []
    for (var i = 0; i < json.items.length; i++) {
      promises.push(getPathObj(["cPointers", json.items[i]]))
    }
    Promise.all(promises).then(contractPointers => {
      promises = []
      for (var i = 0; i < contractPointers.length; i++) {
        if (typeof contractPointers[i] == "string") {
          promises.push(getPathObj(["contract", contractPointers[i], json.items[i]]))
        }
      }
      Promise.all(promises).then(contracts => {
        var ops = []
        for (var i = 0; i < contracts.length; i++) {
          const contract = contracts[i]
          const keys = contract.n ? Object.keys(contract.n) : []
          var msg = `@${from} Removed|`
          var dec = false
          var j
          for (j = 1; j < keys.length + 1; j++) {
            if (dec) {
              contract.n[`${Base64.fromNumber(j - 1)}`] = contract.n[`${Base64.fromNumber(j)}`]
              delete contract.n[`${Base64.fromNumber(j)}`]
            }
            if (contract.n[`${Base64.fromNumber(j)}`] == from) {
              delete contract.n[`${Base64.fromNumber(j)}`]
              dec = true
            }
            if (j == keys.length && dec) {
              ops.push({
                type: 'del',
                path: ["contract", contract.t, contract.i, 'n', `${Base64.fromNumber(j)}`]
              })
            }
          }
          if (dec) {
            contract.nt = Base64.fromNumber(j - 2)
            console.log(contract)
            ops.push({
              type: "put",
              path: ["contract", contract.t, contract.i],
              data: contract,
            })
            msg += `${contract.i},`
          }
        }
        if (msg.charAt(msg.length - 1) != '|') {
          msg = msg.substring(0, msg.length - 1)
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        }
        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
        store.batch(ops, pc)
      })
    })
  } else {
    pc[0](pc[2]);
  }
}

/* write a summary of contract_close:
Contract close allows the file owner to remove the files from the incentivized storage solution. refunding broca to the accounts that have paid. IPFS will not immediately delete these files and other parties could take responsibility for wrapping them in contracts. 
*/

exports.contract_close = (json, from, active, pc) => {
  if (active && json?.id.indexOf(':') > 0) {
    var Pstats = getPathObj(["stats"])
    var Pcontract = getPathObj(["contract", from, json.id])
    var Pproffer = getPathObj(['proffer', from, json.id.split(":")[0]])
    Promise.all([Pstats, Pcontract, Pproffer]).then(mem => {
      var stats = mem[0],
        contract = mem[1],
        proffer = mem[2],
        ops = [],
        err = '', //no log no broca?
        type = "1"
      Object.keys(proffer).forEach(item => {
        if (proffer[item].i == json.id) {
          type = item
          proffer = proffer[item]
        }
      })
      if (contract.e) {
        var extentions = []
        try { extentions = contract.ex.split(',') } catch (e) { }
        var promises = []
        for (var i = 0; i < extentions.length; i++) {
          promises.push(getPathObj(["broca", extentions[i].split(':')[0]]))
          promises.push(getPathObj(["bpow", extentions[i].split(':')[0]]))
        }
        Promise.all(promises).then(exts => {
          var refunds = {}, promises = []
          for (var i = 0; i < extentions.length; i++) {
            if (extentions[i].split(':')[2] && parseInt(extentions[i].split(':')[2].split('-')[1]) > json.block_num) {
              if (parseInt(extentions[i].split(':')[2].split('-')[0]) > json.block_num) {
                if (refunds[extentions[i].split(':')[0]]) refunds[extentions[i].split(':')[0]].a += parseInt(extentions[i].split(':')[1])
                else refunds[extentions[i].split(':')[0]] = {
                  a: parseInt(extentions[i].split(':')[1]),
                  i: i * 2
                }
              } else {
                if (refunds[extentions[i].split(':')[0]]) refunds[extentions[i].split(':')[0]].a += parseInt(parseInt(extentions[i].split(':')[1]) * ((parseInt(extentions[i].split(':')[2].split('-')[1]) - json.block_num) / (parseInt(extentions[i].split(':')[2].split('-')[1]) - parseInt(extentions[i].split(':')[2].split('-')[0]))))
                else refunds[extentions[i].split(':')[0]] = {
                  a: parseInt(parseInt(extentions[i].split(':')[1]) * ((parseInt(extentions[i].split(':')[2].split('-')[1]) - json.block_num) / (parseInt(extentions[i].split(':')[2].split('-')[1]) - parseInt(extentions[i].split(':')[2].split('-')[0])))),
                  i: i * 2
                }
              }
            }
          }
          console.log('refund calc:', exts[0], exts[1], stats, json.block_num)
          console.log(refunds)
          for (var account in refunds) {
            console.log({ account }, exts[refunds[account].i + 1], exts[refunds[account].i + 1], stats, json.block_num, refunds[account].a)
            ops.push({
              type: 'put',
              path: ['broca', account],
              data: broca_calc(exts[refunds[account].i], exts[refunds[account].i + 1], stats, json.block_num, refunds[account].a)
            })
          }
          var items = Object.keys(contract.df)//goods
          var bytes = 0
          var files = 0
          for (var i = 0; i < items.length; i++) {
            bytes += contract.df[items[i]]
            ops.push({ type: "del", path: ['IPFS', items[i].split("").reverse().join("")] });
          }
          files = items.length
          stats.total_bytes -= bytes
          stats.total_files -= files
          ops.push({
            type: "put",
            path: ["stats"],
            data: stats
          });
          ops.push({
            type: "del",
            path: ['ben', from, json.id.split(":")[0]]
          });
          ops.push({ type: "del", path: ['contract', contract.t, json.id] });
          ops.push({ type: "del", path: ['cPointers', json.id] });
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: `${json.id} canceled by file owner.`,
          });

          ops.push({
            type: "del",
            path: ['proffer', from, json.id.split(":")[0]]
          });
          ops.push({ type: "del", path: ["chrono", contract.e] });
          if (config.hookurl || config.status) postToDiscord(`${contract.i} canceled by file owner.`, `${json.block_num}:${json.transaction_id}`);
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        })
      } else if (proffer.e) {
        var promises = []
        promises.push(getPathObj(["broca", proffer.f]))
        promises.push(getPathObj(["bpow", proffer.f]))
        Promise.all(promises).then(exts => {
          ops.push({
            type: 'put',
            path: ['broca', proffer.f],
            data: broca_calc(exts[0], exts[1], stats, json.block_num, proffer.r)
          })
          ops.push({
            type: "del",
            path: ['proffer', from, json.id.split(":")[0]]
          });
          ops.push({
            type: "del",
            path: ['ben', from, json.id.split(":")[0]]
          });
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: `${json.id} canceled by channel owner.`,
          });
          ops.push({ type: "del", path: ["chrono", proffer.e] });
          if (config.hookurl || config.status) postToDiscord(`${json.id} canceled by channel owner.`, `${json.block_num}:${json.transaction_id}`);
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        })
      } else {
        pc[0](pc[2]);
      }
    })
  } else {
    pc[0](pc[2]);
  }
};

/*
only owner can update metadata
json.id = contract id
json.m = memo (string only)
*/

// exports.update_metadata = (json, from, active, pc) => {
//   if (active && json.id && json.m && typeof json.m == "string") {
//     var Pcontract = getPathObj(["contract", from, json.id])
//     Promise.all([Pcontract]).then(mem => {
//       var contract = mem[0],
//         ops = [],
//         err = '' //no log no broca?
//       if (contract.e) {
//         contract.m = json.m
//         //replace all non-allows chars with -
//         contract.m = stringify(contract.m)
//         ops.push({
//           type: "put",
//           path: ["contract", from, json.id],
//           data: contract,
//         });
//         if (config.hookurl || config.status) postToDiscord(`${from} updated metadata for ${json.id}`, `${json.block_num}:${json.transaction_id}`);
//         if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
//         store.batch(ops, pc);
//       } else {
//         pc[0](pc[2]);
//       }
//     })
//   } else {
//     pc[0](pc[2]);
//   }
// }

const jsdiff = require('diff'); // Ensure this library is included in your project

exports.update_metadata = (json, from, active, pc) => {
  if (active && json.id) {
    var Pcontract = getPathObj(["contract", from, json.id]);
    var Ppartial = getPathObj(["partial_metadata_updates", json.id.split(':')[2]]);

    Promise.all([Pcontract, Ppartial]).then(mem => {
      var contract = mem[0];
      var partial = mem[1];
      var ops = [];

      // Check if contract exists and is editable
      if (!contract || !contract.e) {
        console.log("Contract not found or not editable");
        pc[0](pc[2]);
        return;
      }

      if (json.chunk_data && json.chunk_id && json.total_chunks) {
        // Handle chunked update for full metadata replacement
        const chunk_id = json.chunk_id;
        const total_chunks = json.total_chunks;
        const chunk_data = json.chunk_data;

        // Initialize partial storage if it doesn't exist
        if (!partial) {
          partial = {
            total_chunks: total_chunks,
            from: from,
            chunks: {}
          };
        } else {
          // Verify sender consistency
          if (partial.from !== from) {
            console.log("Error: Chunks from different senders");
            pc[0](pc[2]);
            return;
          }
          if (partial.total_chunks !== total_chunks) {
            console.log("Error: Inconsistent total_chunks");
            pc[0](pc[2]);
            return;
          }
        }

        // Store the chunk
        partial.chunks[chunk_id] = chunk_data;

        // Check if all chunks are received
        if (Object.keys(partial.chunks).length === total_chunks) {
          // Assemble complete metadata
          let complete_metadata = "";
          for (let i = 1; i <= total_chunks; i++) {
            if (!partial.chunks[i]) {
              console.log(`Error: Missing chunk ${i}`);
              pc[0](pc[2]);
              return;
            }
            complete_metadata += partial.chunks[i];
          }

          // Update contract metadata
          contract.m = complete_metadata;
          // Clean up partial storage
          ops.push({
            type: "del",
            path: ["partial_metadata_updates", json.id.split(':')[2]]
          });
          // Notify
          if (config.hookurl || config.status) {
            postToDiscord(`${from} updated metadata for ${json.id} via chunks`, `${json.block_num}:${json.transaction_id}`);
          }
        } else {
          // Store partial update and wait for more chunks
          ops.push({
            type: "put",
            path: ["partial_metadata_updates", json.id.split(':')[2]],
            data: partial
          });
        }
      } else if (json.m && typeof json.m === "string") {
        // Single-transaction full replacement (original behavior)
        contract.m = json.m;
        contract.m = stringify(contract.m); // Preserve existing stringify call
        if (config.hookurl || config.status) {
          postToDiscord(`${from} updated metadata for ${json.id}`, `${json.block_num}:${json.transaction_id}`);
        }
      } else if (json.diff && typeof json.diff === "string") {
        // Diff-based update
        const currentMetadata = contract.m;
        const newMetadata = jsdiff.applyPatch(currentMetadata, json.diff);

        if (newMetadata === false) {
          console.log("Error: Failed to apply diff");
          pc[0](pc[2]);
          return;
        }

        contract.m = newMetadata;
        if (config.hookurl || config.status) {
          postToDiscord(`${from} updated metadata for ${json.id} via diff`, `${json.block_num}:${json.transaction_id}`);
        }
      } else {
        console.log("Invalid update request");
        pc[0](pc[2]);
        return;
      }

      // Save the updated contract
      ops.push({
        type: "put",
        path: ["contract", from, json.id],
        data: contract
      });

      if (process.env.npm_lifecycle_event === "test") pc[2] = ops;
      store.batch(ops, pc);
    }).catch(e => {
      console.log("Error:", e);
      pc[0](pc[2]);
    });
  } else {
    console.log("Unauthorized or missing ID");
    pc[0](pc[2]);
  }
};