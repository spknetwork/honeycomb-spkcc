const config = require('../config')
const { store } = require("../index");
const { getPathNum, getPathObj } = require("../getPathObj");
const { postToDiscord } = require('../discord');

exports.send_spk = (json, from, active, pc) => {
  let fbalp = getPathNum(["spkb", from]),
    tbp = getPathNum(["spkb", json.to]); //to balance promise
  Promise.all([fbalp, tbp])
    .then((bals) => {
      let fbal = bals[0],
        tbal = bals[1],
        ops = [];
      send = parseInt(json.amount);
      if (
        json.to &&
        typeof json.to == "string" &&
        send > 0 &&
        fbal >= send &&
        active &&
        json.to != from
      ) {
        //balance checks
        ops.push({
          type: "put",
          path: ["spkb", from],
          data: parseInt(fbal - send),
        });
        ops.push({
          type: "put",
          path: ["spkb", json.to],
          data: parseInt(tbal + send),
        });
        let msg = `@${from}| Sent @${json.to} ${parseFloat(
          parseInt(json.amount) / 1000
        ).toFixed(3)} SPK`;
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
          data: `@${from}| Invalid send operation`,
        });
      }
      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
      store.batch(ops, pc);
    })
    .catch((e) => {
      console.log(e);
    });
};
