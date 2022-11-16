const config = require("./../config");
const { store } = require("../index");
const { getPathObj, getPathNum } = require("../getPathObj");
const { chronAssign, reward_spk } = require("../lil_ops");
const { Base64 } = require("../helpers")
const { postToDiscord } = require("./../discord");

exports.power_up = (json, from, active, pc) => {
  reward_spk(from, json.block_num).then((interest) => {
    var amount = parseInt(json.amount),
      lpp = getPathNum(["balances", from]),
      tpowp = getPathNum(["pow", "t"]),
      powp = getPathNum(["pow", from]);

    Promise.all([lpp, tpowp, powp])
      .then((bals) => {
        let lb = bals[0],
          tpow = bals[1],
          pow = bals[2],
          lbal = typeof lb != "number" ? 0 : lb,
          pbal = typeof pow != "number" ? 0 : pow,
          ops = [];
        if (amount <= lbal && active) {
          ops.push({
            type: "put",
            path: ["balances", from],
            data: lbal - amount,
          });
          ops.push({
            type: "put",
            path: ["pow", from],
            data: pbal + amount,
          });
          ops.push({
            type: "put",
            path: ["pow", "t"],
            data: tpow + amount,
          });
          const msg = `@${from}| Powered ${parseFloat(
            json.amount / 1000
          ).toFixed(3)} ${config.TOKEN}`;
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
            data: `@${from}| Invalid power up`,
          });
        }
        store.batch(ops, pc);
      })
      .catch((e) => {
        console.log(e);
      });
  });
};

exports.power_grant = (json, from, active, pc) => {
  var amount = parseInt(json.amount),
    to = json.to,
    Pgranting_from_total = getPathNum(["granting", from, "t"]),
    Pgranting_to_from = getPathNum(["granting", from, to]),
    Pgranted_to_from = getPathNum(["granted", to, from]),
    Pgranted_to_total = getPathNum(["granted", to, "t"]),
    Ppower = getPathNum(["pow", from]),
    Pup_from = getPathObj(["up", from]),
    Pdown_from = getPathObj(["down", from]),
    Pup_to = getPathObj(["up", to]),
    Pdown_to = getPathObj(["down", to]),
    Pgov = getPathNum(["gov", to]);
  (Pinterest = reward_spk(from, json.block_num)), //interest calc before balance changes.
    (Pinterest2 = reward_spk(json.to, json.block_num));
  Promise.all([
    Ppower,
    Pgranted_to_from,
    Pgranted_to_total,
    Pgranting_to_from,
    Pgranting_from_total,
    Pup_from,
    Pup_to,
    Pdown_from,
    Pdown_to,
    Pgov,
    Pinterest,
    Pinterest2,
  ])
    .then((mem) => {
      let from_power = mem[0],
        granted_to_from = mem[1],
        granted_to_total = mem[2],
        granting_to_from = mem[3],
        granting_from_total = mem[4],
        up_from = mem[5],
        up_to = mem[6],
        down_from = mem[7],
        down_to = mem[8],
        ops = [];
      if (amount <= from_power && amount >= 0 && active && mem[9]) {
        //mem[9] checks for gov balance in to account.
        if (amount > granted_to_from) {
          let more = amount - granted_to_from;
          if (up_from.max) {
            up_from.max -= more;
          }
          if (down_from.max) {
            down_from.max -= more;
          }
          if (up_to.max) {
            up_to.max += more;
          }
          if (down_to.max) {
            down_to.max += more;
          }
          ops.push({
            type: "put",
            path: ["granting", from, "t"],
            data: granting_from_total + more,
          });
          ops.push({
            type: "put",
            path: ["granting", from, to],
            data: granting_to_from + more,
          });
          ops.push({
            type: "put",
            path: ["granted", to, from],
            data: granted_to_from + more,
          });
          ops.push({
            type: "put",
            path: ["granted", to, "t"],
            data: granted_to_total + more,
          });
          ops.push({
            type: "put",
            path: ["pow", from],
            data: from_power - more,
          }); //weeks wait? chron ops? no because of the power growth at vote
          if (Object.keys(up_from).length)
            ops.push({
              type: "put",
              path: ["up", from],
              data: up_from,
            });
          if (Object.keys(down_from).length)
            ops.push({
              type: "put",
              path: ["down", from],
              data: down_from,
            });
          if (Object.keys(up_to).length)
            ops.push({ type: "put", path: ["up", to], data: up_to });
          if (Object.keys(down_to).length)
            ops.push({
              type: "put",
              path: ["down", to],
              data: down_to,
            });
          const msg = `@${from}| Has granted ${parseFloat(
            amount / 1000
          ).toFixed(3)} to ${to}`;
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
        } else if (amount < granted_to_from) {
          let less = granted_to_from - amount;
          if (up_from.max) {
            up_from.max += less;
          }
          if (down_from.max) {
            down_from.max += less;
          }
          if (up_to.max) {
            up_to.max -= less;
          }
          if (down_to.max) {
            down_to.max -= less;
          }
          ops.push({
            type: "put",
            path: ["granting", from, "t"],
            data: granting_from_total - less,
          });
          ops.push({
            type: "put",
            path: ["granting", from, to],
            data: granting_to_from - less,
          });
          ops.push({
            type: "put",
            path: ["granted", to, from],
            data: granted_to_from - less,
          });
          ops.push({
            type: "put",
            path: ["granted", to, "t"],
            data: granted_to_total - less,
          });
          ops.push({
            type: "put",
            path: ["pow", from],
            data: from_power + less,
          });
          if (Object.keys(up_from).length)
            ops.push({
              type: "put",
              path: ["up", from],
              data: up_from,
            });
          if (Object.keys(down_from).length)
            ops.push({
              type: "put",
              path: ["down", from],
              data: down_from,
            });
          if (Object.keys(up_to).length)
            ops.push({ type: "put", path: ["up", to], data: up_to });
          if (Object.keys(down_to).length)
            ops.push({
              type: "put",
              path: ["down", to],
              data: down_to,
            });
          const msg = `@${from}| Has granted ${parseFloat(
            amount / 1000
          ).toFixed(3)} to ${to}`;
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
        } else {
          const msg = `@${from}| Has already granted ${parseFloat(
            amount / 1000
          ).toFixed(3)} to ${to}`;
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
        }
      } else {
        const msg = `@${from}| Invalid delegation`;
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
    .catch((e) => {
      console.log(e);
    });
};

exports.power_down = (json, from, active, pc) => {
  var powp = getPathNum(["pow", from]),
    powd = getPathObj(["powd", from]);
  Promise.all([powp, powd])
    .then((o) => {
      let p = typeof o[0] != "number" ? 0 : o[0],
        downs = o[1] || {},
        ops = [],
        assigns = [],
        amount = parseInt(json.amount);
      if (typeof amount == "number" && amount >= 0 && p >= amount && active) {
        var odd = parseInt(amount % 4),
          weekly = parseInt(amount / 4);
        for (var i = 0; i < 4; i++) {
          if (i == 3) {
            weekly += odd;
          }
          assigns.push(
            chronAssign(parseInt(json.block_num + 200000 * (i + 1)), {
              block: parseInt(json.block_num + 200000 * (i + 1)),
              op: "power_down",
              amount: weekly,
              by: from,
            })
          );
        }
        Promise.all(assigns).then((a) => {
          var newdowns = {};
          for (d in a) {
            newdowns[a[d]] = a[d];
          }
          ops.push({
            type: "del",
            path: ["powd", from],
          });
          ops.push({ type: "put", path: ["powd", from], data: newdowns });
          for (i in downs) {
            ops.push({ type: "del", path: ["chrono", i] });
          }
          const msg = `@${from}| Powered down ${parseFloat(
            amount / 1000
          ).toFixed(3)} ${config.TOKEN}`;
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
          store.batch(ops, pc);
        });
      } else if (typeof amount == "number" && amount == 0 && active) {
        for (i in downs) {
          ops.push({ type: "del", path: ["chrono", downs[i]] });
        }
        const msg = `@${from}| Canceled Power Down`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        store.batch(ops, pc);
      } else {
        const msg = `@${from}| Invalid Power Down`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        store.batch(ops, pc);
      }
    })
    .catch((e) => {
      console.log(e);
    });
};

exports.spk_up = (json, from, active, pc) => {
  reward_spk(from, json.block_num).then((interest) => {
    var amount = parseInt(json.amount),
      lpp = getPathNum(["spk", from]),
      tpowp = getPathNum(["spow", "t"]),
      powp = getPathNum(["spow", from]);

    Promise.all([lpp, tpowp, powp])
      .then((bals) => {
        let lb = bals[0],
          tpow = bals[1],
          pow = bals[2],
          lbal = typeof lb != "number" ? 0 : lb,
          pbal = typeof pow != "number" ? 0 : pow,
          ops = [];
        if (amount <= lbal && active) {
          ops.push({
            type: "put",
            path: ["spk", from],
            data: lbal - amount,
          });
          ops.push({
            type: "put",
            path: ["spow", from],
            data: pbal + amount,
          });
          ops.push({
            type: "put",
            path: ["spow", "t"],
            data: tpow + amount,
          });
          const msg = `@${from}| Powered ${parseFloat(
            json.amount / 1000
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
            data: `@${from}| Invalid SPK power up`,
          });
        }
        store.batch(ops, pc);
      })
      .catch((e) => {
        console.log(e);
      });
  });
};


exports.spk_down = (json, from, active, pc) => {
  var powp = getPathNum(["spow", from]),
    powd = getPathObj(["spowd", from]),
    pstats = getPathNum(['stats', 'spk_cycle_length'])
  Promise.all([powp, powd, pstats])
    .then((o) => {
      let p = typeof o[0] != "number" ? 0 : o[0],
        downs = o[1] || {},
        spk_time = o[2]
        ops = [],
        assigns = [],
        amount = parseInt(json.amount);
      if (typeof amount == "number" && amount >= 0 && p >= amount && active) {
        var odd = parseInt(amount % 4),
          weekly = parseInt(amount / 4);
        for (var i = 0; i < 4; i++) {
          if (i == 3) {
            weekly += odd;
          }
          assigns.push(
            chronAssign(parseInt(json.block_num + (parseInt(spk_time/4) * (i + 1))), {
              block: parseInt(json.block_num + (parseInt(spk_time/4) * (i + 1))),
              op: "spower_down",
              amount: weekly,
              by: from,
            })
          );
        }
        Promise.all(assigns).then((a) => {
          var newdowns = {};
          for (d in a) {
            newdowns[a[d]] = a[d];
          }
          ops.push({
            type: "del",
            path: ["spowd", from],
          });
          ops.push({ type: "put", path: ["spowd", from], data: newdowns });
          for (i in downs) {
            ops.push({ type: "del", path: ["chrono", i] });
          }
          const msg = `@${from}| Powering down ${parseFloat(
            amount / 1000
          ).toFixed(3)} SPK`;
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops.push({
            type: "put",
            path: ["feed", `${json.block_num}:${json.transaction_id}`],
            data: msg,
          });
          store.batch(ops, pc);
        });
      } else if (typeof amount == "number" && amount == 0 && active) {
        for (i in downs) {
          ops.push({ type: "del", path: ["chrono", downs[i]] });
        }
        const msg = `@${from}| Canceled SPK Power Down`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        store.batch(ops, pc);
      } else {
        const msg = `@${from}| Invalid SPK Power Down`;
        if (config.hookurl || config.status)
          postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: msg,
        });
        store.batch(ops, pc);
      }
    })
    .catch((e) => {
      console.log(e);
    });
};

exports.spk_vote = (json, from, active, pc) => {
  var ops = []
  if (active) {
    var powp = getPathNum(["spow", from]),
      tpowp = getPathNum(["spow", "t"]),
      dpowp = getPathObj(["spowd", from]),
      votebp = getPathObj(['spkVote', from]),
      pstats = getPathNum(['stats'])
  Promise.all([powp, tpowp, dpowp, votebp, pstats]).then((mem) => {
    var stats = mem[4]
    const DAOString = mem[3].substring(mem[3].indexOf(",")),
      lastVote = Base64.toNumber(mem[3].split(",")[0])
        ? Base64.toNumber(mem[3].split(",")[0])
        : json.block_num - stats.spk_cycle_length,
      thisVote =
        Base64.fromNumber(json.block_num) + "," + (DAOString ? DAOString : ""),
      ago = json.block_num - lastVote
      total = mem[1],
      power = mem[0]
      downs = Object.keys(mem[2])
      var effective_power = power, effective_total
      if(downs.length){
        getPathObj(['chrono', downs[0]]).then(down =>{
          finish(down)
        })
      } else {
        finish()
      }
      function finish(down_obj) {
        if(down_obj?.amount){
          effective_power = power - down_obj?.amount
        }
        if (ago < stats.spk_cycle_length)effective_power = parseInt(effective_power * (ago / stats.spk_cycle_length))
        else if (ago > stats.spk_cycle_length && ago < stats.spk_cycle_length * 2)effective_power = effective_power* parseInt(
          effective_power *
            (1 - ((ago - stats.spk_cycle_length) / stats.spk_cycle_length) / 2)
        )
        else if (ago >= stats.spk_cycle_length * 2)effective_power = parseInt(effective_power/2)
        effective_total = effective_total - effective_power
        const voteWeight = parseFloat(effective_power/effective_total).toFixed(8)
        const decayWeight = parseFloat(
          (effective_total - effective_power) / effective_total
        ).toFixed(8);
        //verify inputs, adjust constants
        stats.item = (json.vote * voteWeight) + (decayWeight * stats.item)
        ops.push({
          type: "put",
          path: ["stats"],
          data: stats,
        });
        ops.push({
          type: "put",
          path: ["spkVote", from],
          data: thisVote,
        });
        ops.push({
          type: "put",
          path: ["feed", `${json.block_num}:${json.transaction_id}`],
          data: `@${from}| Has updated their votes.`,
        });
        store.batch(ops, pc);
      }
  });
  } else {
    ops.push({
      type: "put",
      path: ["feed", `${json.block_num}:${json.transaction_id}`],
      data: `@${from}| Attempted SPK vote with posting key`,
    });
    store.batch(ops, pc);
  }
}