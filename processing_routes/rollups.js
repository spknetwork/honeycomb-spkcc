const config = require("./../config");
const { store } = require("./../index");
const hiveTx = require("hive-tx");
const { sha256 } = require("hive-tx/helpers/crypto");
const HR = require("./index")
const base64url = require("base64url");
const { getPathObj } = require("../getPathObj");

/*{
rollups: ['j.w.ts','j.w.ts']
}*/

exports.rollup = (json, from, active, pc) => {
    var inputs = json.rollups
    var verified_inputs = []
    var requirements = [], promises = []
    for (var i = 0 ; i < inputs.length; i++){
        var operation = {}
        operation.array = inputs[i].split(".");
        if (typeof inputs[i] == "string" && operation.array.length == 3) {
            operation.header = JSON.parse(base64url.decode(operation.array[0]))
            operation.payload = JSON.parse(
              base64url.decode(operation.array[1])
            );
            operation.sig = operation.array[2];
            if (
              operation.header.from &&
              config.rollup_ops.indexOf(operation.header.op) >= 0
            ) {
              requirements.push([i, ["authorities", from]]);
              operation.index = i;
              verified_inputs.push(operation);
            }
        }
    }
    if (requirements.length)
      for (var i = 0; i < requirements.length; i++) {
        promises.push(getPathObj(requirements[i][1]));
        Promise.all(promises).then((pubKeys) => {
          for (var i = 0; i < requirements.length; i++) {
            if (typeof pubKeys[i] == "string") requirements[i].push(pubKeys[i]);
          }
          for (var i = 0; i < verified_inputs.length; i++){
            if(requirements[verified_inputs[i].index][2]){
                verified_inputs[i].pubKey = requirements[verified_inputs[i].index][2];
                const digest = sha256(`${verified_inputs[i].array[0]}.${verified_inputs[i].array[1]}`);
                const publicKey = hiveTx.PublicKey.from(
                  verified_inputs[i].pubKey
                );
                verified_inputs[i].authorized = publicKey.verify(
                  digest,
                  hiveTx.Signature.from(verified_inputs[i].array[2])
                );
            } else {
                verified_inputs.splice(i,1)
                i--
            }
          }
          var opChain = []
          for (var i = 0; i < verified_inputs.length; i ++){
            if(verified_inputs[i].authorized){
                var payload = verified_inputs[i].payload;
                payload.block_num = json.block_num
                payload.transaction_id = json.transaction_id + ":" + i
                payload.transaction_num = json.transaction_num + ":" + i;
                opChain.push([verified_inputs[i].header.op, verified_inputs[i].header.from, payload])
            }
          }
          doOps(opChain).then(r => pc[0](pc[2]))
        });
      } else {
      pc[0](pc[2]);
    }
};

function doOps(opChain){
    return new Promise((resolve, reject) => {
        if(opChain.length){
            const currentOp = opChain.shift()
            doOp(currentOp, opChain).then(pc=>{
                if (pc.length) doOps(pc)
                else resolve('DONE')
            })
        } else {
            resolve('DONE')
        }
    })
}

function doOp(op, pc) {
    return new Promise((resolve, reject) => {
        HR[op[0]](op[1], op[2], true, [
        resolve,
        reject,
        pc,
        ]);
    });
}

exports.register_authority = (json, from, active, pc) => {
  if (
    active &&
    json.pubKey &&
    typeof json.pubKey == "string" &&
    json.pubKey.subStr(0, 3) == "STM" && json.pubKey.length == 53 ) {
    var ops = [{ type: "put", path: ["authorities", from], data: json.pubKey }];
    store.batch(ops, pc);
  } else {
    pc[0](pc[2]);
  }
};

exports.channel_open = (json, from, active, pc) => {
  if (true){
    
  } else {
    pc[0](pc[2]);
  }
};

exports.channel_update = (json, from, active, pc) => {
  if (true) {
  } else {
    pc[0](pc[2]);
  }
};

exports.channel_close = (json, from, active, pc) => {
  if (true) {
  } else {
    pc[0](pc[2]);
  }
};
