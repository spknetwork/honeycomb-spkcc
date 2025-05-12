import dotenv from 'dotenv';
dotenv.config();

const ENV = process.env;

const username = ENV.account || 'disregardfiat';
const active = ENV.active || '';
const follow = ENV.follow || 'disregardfiat';
const poav_address = ENV.POA_URL || ""
const msowner = ENV.msowner || '';
const mspublic = ENV.mspublic || '';
const memoKey = ENV.memo || '';
const hookurl = ENV.discordwebhook || false;
const NODEDOMAIN = ENV.domain || '' //where your API lives
const state = ENV.state || false
const acm = ENV.account_creator || false //account creation market ... use your accounts HP to claim account tokens
const mirror = ENV.mirror || false //makes identical posts, votes and IPFS pins as the leader account
const port = ENV.PORT || 3001;
const pintoken = ENV.pintoken || ''
const pinurl = ENV.pinurl || '';
const status = ENV.status || true
const dbcs = ENV.DATABASE_URL || ''; //connection string to a postgres database
const dbmods = ENV.DATABASE_MODS || []; //list of moderators to hide posts in above db
const typeDefs = ENV.APPTYPES || {
  ["360"]: ['QmNby3SMAAa9hBVHvdkKvvTqs7ssK4nYa2jBdZkxqmRc16'],
}
const history = ENV.history || 3600
const stream = ENV.stream || 'irreversible'
const mode = ENV.mode || "normal";
const timeoutStart = ENV.timeoutStart || 180000;
const timeoutContinuous = ENV.timeoutContinuous || 30000;

// testing configs for replays
const override = ENV.override || 0 //69116600 //will use standard restarts after this blocknumber
const engineCrank = ENV.startingHash || 'QmconUD3faVGbgC2jAXRiueEuLarjfaUiDz5SA74kptuvu' //but this state will be inserted before

// third party configs
const rta = ENV.rta || '' //rtrades account : IPFS pinning interface
const rtp = ENV.rtp || '' //rtrades password : IPFS pinning interface

const ipfshost = ENV.ipfshost || 'localhost' //IPFS upload/download provider provider
const ipfsport = ENV.ipfsport || '5001' //IPFS upload/download provider provider
const ipfsprotocol = ENV.ipfsprotocol || 'http' //IPFS upload/download protocol
var ipfsLinks = ENV.ipfsLinks
  ? ENV.ipfsLinks.split(" ")
  : [
    `${ipfsprotocol}://${ipfshost}:${ipfsport}/`,
    "https://ipfs.dlux.io/ipfs/",
    "https://ipfs.3speak.tv/ipfs/",
    "https://infura-ipfs.io/ipfs/",
    "https://ipfs.alloyxuast.co.uk/ipfs/",
  ];

//node market config > 2500 is 25% inflation to node operators, this is currently not used
const bidRate = ENV.BIDRATE || 2500 //

//HIVE CONFIGS
var startURL = ENV.STARTURL || "https://hive-api.dlux.io/ipfs/";
var clientURL = ENV.APIURL || "https://hive-api.dlux.io/";
const clients = ENV.clients
  ? ENV.clients.split(" ")
  : [
    "https://api.hive.blog/",
    "https://api.deathwing.me/",
    "https://hive-api.dlux.io/",
    "https://rpc.ecency.com/",
    "https://hived.emre.sh/",
    "https://rpc.ausbit.dev/",

  ];

//!!!!!!! -- THESE ARE COMMUNITY CONSTANTS -- !!!!!!!!!//
//TOKEN CONFIGS -- ALL COMMUNITY RUNNERS NEED THESE SAME VALUES
const starting_block = 86345601; //from what block does your token start
const prefix = 'spkccT_' //Community token name for Custom Json IDs
const TOKEN = 'LARYNX' //Token name
const precision = 3 //precision of token
const tag = 'spk' //the fe.com/<tag>/@<leader>/<permlink>
const jsonTokenName = 'larynx' //what customJSON in Escrows and sends is looking for
const leader = 'spk-test' //Default account to pull state from, will post token 
const ben = '' //Account where comment benifits trigger token action
const delegation = '' //account people can delegate to for rewards
const delegationWeight = 1000 //when to trigger community rewards with bens
const msaccount = ENV.msaccount || 'spk-cc-test' //account controlled by community leaders
const msPubMemo = 'STM8hszG2prkmSBsPpgQ4ZipdGq5MMK7zoJDXD7cV2FL83HXascWk' //memo key for msaccount
const msPriMemo = '5KGUzqXqHwhQRDg5m2UH6CGCEuKHgSuNzQnvVGv1q2xeovuV5cN'
const msmeta = ''
const mainAPI = 'spktest.dlux.io' //leaders API probably
const mainRender = '' //data and render server
const mainFE = 'dlux.io' //frontend for content
const mainIPFS = 'ipfs.dlux.io' //IPFS service
const mainICO = '' //Account collecting ICO HIVE
const footer = `\n[Find us on Discord](https://discord.gg/YEHvWEvvey)`
const adverts = [
  'https://camo.githubusercontent.com/954558e3ca2d68e0034cae13663d9807dcce3fcf/68747470733a2f2f697066732e627573792e6f72672f697066732f516d64354b78395548366a666e5a6748724a583339744172474e6b514253376359465032357a3467467132576f50'
]
const detail = {
  name: 'Larynx Miner Token',
  symbol: 'LARYNX',
  icon: 'https://www.dlux.io/img/spknetwork/larynx_icon.png',
  supply: 'Hive 1:1 Airdrop',
  wp: `https://docs.google.com/document/d/1_jHIJsX0BRa5ujX0s-CQg3UoQC2CBW4wooP2lSSh3n0/edit?usp=sharing`,
  ws: `https://dlux.io`,
  be: `https://hiveblockexplorer.com/`,
  text: `Larynx is a token that is used to mine SPK.`
}

const hive_service_fee = 100 //HIVE service fee for transactions in Hive/HBD in centipercents (1% = 100)
const features = {
  pob: false, //proof of brain
  pobTag: false, //accept PoB on posts with config.tag
  delegate: false, //delegation
  daily: true, // daily post
  liquidity: false, //liquidity
  ico: false, //ico
  inflation: true,
  dex: true, //dex
  nft: false, //nfts
  claimdrop: false //claim drops
}

const CustomJsonProcessing = [
  {
    type: "on",
    op: "spk_send",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord } = context
      let fbalp = getPathNum(["spk", from]),
        tbp = getPathNum(["spk", json.to]),
        spkTotal = getPathNum(["spk", "t"]),
        Pstats = getPathObj(["stats"]); //to balance promise
      Promise.all([fbalp, tbp, Pstats])
        .then((mem) => {
          let fbal = mem[0],
            tbal = mem[1],
            stats = mem[2],
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
            let clawback = 0
            if (stats.broca_clawback) {
              clawback = parseInt(send * stats.broca_clawback / 10000)
              ops.push({
                type: "put",
                path: ["spk", "t"],
                data: parseInt(spkTotal - clawback)
              })
            }
            send = parseInt(send - clawback)
            ops.push({
              type: "put",
              path: ["spk", from],
              data: parseInt(fbal - send),
            });
            ops.push({
              type: "put",
              path: ["spk", json.to],
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
              data: `@${from}| Invalid SPK send operation`,
            });
          }
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        })
        .catch((e) => {
          console.log(e);
        });
    }
  },
  {
    type: "on",
    op: "broca_send",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord } = context
      let fbalp = getPathNum(["lbroca", from]),
        tbp = getPathNum(["lbroca", json.to]),
        spkTotal = getPathNum(["lbroca", "t"]),
        Pstats = getPathObj(["stats"]); //to balance promise
      Promise.all([fbalp, tbp, Pstats])
        .then((mem) => {
          let fbal = mem[0],
            tbal = mem[1],
            stats = mem[2],
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
            let clawback = 0
            if (stats.broca_clawback) {
              clawback = parseInt(send * stats.broca_clawback / 10000)
              ops.push({
                type: "put",
                path: ["lbroca", "t"],
                data: parseInt(spkTotal - clawback)
              })
            }
            send = parseInt(send - clawback)
            ops.push({
              type: "put",
              path: ["lbroca", from],
              data: parseInt(fbal - send),
            });
            ops.push({
              type: "put",
              path: ["lbroca", json.to],
              data: parseInt(tbal + send),
            });
            let msg = `@${from}| Sent @${json.to} ${parseFloat(
              parseInt(json.amount) / 1000
            ).toFixed(3)} BROCA`;
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
              data: `@${from}| Invalid broca send operation`,
            });
          }
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        })
        .catch((e) => {
          console.log(e);
        });
    }
  },
  {
    type: "on",
    op: "spk_power_up",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord, Base64 } = context
      const Validator = {
        addSPK: function (vals, valStr, add) {
          var votes = this.valStr2Arr(valStr)
          vals = this.addVote(vals, votes, add)
          return vals
        },
        addVote: function (vals, voteArr, spk) {
          for (var i = 0; i < voteArr.length; i++) {
            const weight = parseInt(spk * (30 - i))
            if (typeof vals[voteArr[i]] == "number") vals[voteArr[i]] += weight
          }
          return vals
        },
        valStr2Arr: function (valStr = "") {
          var vals = []
          var a = valStr.split('')
          for (var i = 0; i < valStr.length; i++) {
            var b = `${a[i]}`; i++; b = `${b}${a[i]}`; vals.push(b)
          }
          return [...new Set(vals)]
        },

      }
      var amount = parseInt(json.amount),
        lpp = getPathNum(["spk", from]),
        tpowp = getPathNum(["spow", "t"]),
        powp = getPathNum(["spow", from]),
        pstats = getPathObj(["stats"]),
        votebp = getPathObj(['spkVote', from]),
        valtotp = getPathObj(['val'])
      Promise.all([lpp, tpowp, powp, pstats, votebp, valtotp])
        .then((mem) => {
          let lb = mem[0],
            tpow = mem[1],
            pow = mem[2],
            stats = mem[3],
            daostring = mem[4],
            vals = mem[5],
            lbal = typeof lb != "number" ? 0 : lb,
            pbal = typeof pow != "number" ? 0 : pow,
            ops = [];
          if (amount <= lbal && active) {
            if (typeof daostring == "string") {
              const dif = amount / (pow + amount),
                lastVote = Base64.toNumber(daostring.split(',')[0]),
                ago = json.block_num - lastVote,
                valStr = daostring.split(',')[1]
              if (ago <= (stats.spk_cycle_length * 4)) lastVote = lastVote + parseInt(dif * stats.spk_cycle_length * 4)
              else if (ago <= (stats.spk_cycle_length * 8)) lastVote = lastVote - parseInt(dif * ((stats.spk_cycle_length * 4) - ago))
              else lastVote = lastVote + parseInt(dif * stats.spk_cycle_length * 4)
              if (valStr) {
                vals = Validator.addSPK(vals, valStr, amount)
              }
              daostring = Base64.fromNumber(lastVote) + ',' + valStr
            } else {
              daostring = Base64.fromNumber(json.block_num) + ","
            }
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
    }
  },
  {
    type: "on",
    op: "spk_power_down",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord, chronAssign } = context
      var powp = getPathNum(["spow", from]),
        powd = getPathObj(["spowd", from]),
        pstats = getPathNum(['stats', 'spk_cycle_length'])
      Promise.all([powp, powd, pstats])
        .then((o) => {
          let p = typeof o[0] != "number" ? 0 : o[0],
            downs = o[1] || {},
            spk_time = parseInt(o[2]),
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
                chronAssign(parseInt(json.block_num + (parseInt(spk_time / 4) * (i + 1))), {
                  block: parseInt(json.block_num + (parseInt(spk_time / 4) * (i + 1))),
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
    }
  },
  {
    type: "on",
    op: "broca_power_up",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord, Base64 } = context
      const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
        if (typeof last != "string") last = '0,0'
        const last_calc = Base64.toNumber(last.split(',')[1])
        const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc)) / (pow * (stats.broca_daily_trend > 1000 ? stats.broca_daily_trend : 1000))) //revisit 
        var total = parseInt(last.split(',')[0]) + accured + add
        if (total > (pow * 1000)) total = (pow * 1000)
        return `${total},${Base64.fromNumber(bn)}`
      }
      var amount = parseInt(json.amount),
        lpp = getPathNum(["lbroca", from]),
        tpowp = getPathNum(["bpow", "t"]),
        powp = getPathNum(["bpow", from]),
        pbroca = getPathObj(["broca", from]),
        pstats = getPathObj(["stats"])
      Promise.all([lpp, tpowp, powp, pbroca, pstats])
        .then((mem) => {
          let lb = mem[0],
            tpow = mem[1],
            pow = mem[2],
            broca_string = mem[3],
            stats = mem[4],
            lbal = typeof lb != "number" ? 0 : lb,
            pbal = typeof pow != "number" ? 0 : pow,
            ops = [];
          const broca = broca_calc(typeof broca_string == 'string' ? broca_string : '0,0', pbal, stats, json.block_num)
          const cur_broca = parseInt(broca.split(',')[0]) || 0
          if (amount <= lbal && active) {
            ops.push({
              type: "put",
              path: ["broca", from],
              data: `${cur_broca + (amount * 1000)},${Base64.fromNumber(json.block_num)}`,
            });
            ops.push({
              type: "put",
              path: ["lbroca", from],
              data: lbal - amount,
            });
            ops.push({
              type: "put",
              path: ["bpow", from],
              data: pbal + amount,
            });
            ops.push({
              type: "put",
              path: ["bpow", "t"],
              data: tpow + amount,
            });
            const msg = `@${from}| Powered ${parseFloat(
              json.amount / 1000
            ).toFixed(3)} BROCA`;
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
              data: `@${from}| Invalid BROCA power up`,
            });
          }
          store.batch(ops, pc);
        })
        .catch((e) => {
          console.log(e);
        });
    }
  },
  {
    type: "on",
    op: "broca_power_down",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord, chronAssign } = context
      var powp = getPathNum(["bpow", from]),
        powd = getPathObj(["bpowd", from]),
        pstats = getPathNum(['stats', 'spk_cycle_length'])
      Promise.all([powp, powd, pstats])
        .then((o) => {
          let p = typeof o[0] != "number" ? 0 : o[0],
            downs = o[1] || {},
            spk_time = parseInt(o[2]),
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
                chronAssign(parseInt(json.block_num + (parseInt(spk_time / 4) * (i + 1))), {
                  block: parseInt(json.block_num + (parseInt(spk_time / 4) * (i + 1))),
                  op: "bpower_down",
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
                path: ["bpowd", from],
              });
              ops.push({ type: "put", path: ["bpowd", from], data: newdowns });
              for (i in downs) {
                ops.push({ type: "del", path: ["chrono", i] });
              }
              const msg = `@${from}| Powering down ${parseFloat(
                amount / 1000
              ).toFixed(3)} BROCA`;
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
            const msg = `@${from}| Canceled BROCA Power Down`;
            if (config.hookurl || config.status)
              postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: msg,
            });
            store.batch(ops, pc);
          } else {
            const msg = `@${from}| Invalid BROCA Power Down`;
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
    }
  },
  {
    type: "on",
    op: "spk_vote",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, getPathNum, Base64 } = context
      var ops = []
      if (active) {
        var powp = getPathNum(["spow", from]),
          tpowp = getPathNum(["spow", "t"]),
          dpowp = getPathObj(["spowd", from]),
          votebp = getPathObj(['spkVote', from]),
          pstats = getPathObj(['stats'])
        Promise.all([powp, tpowp, dpowp, votebp, pstats]).then((mem) => {
          var stats = mem[4]
          const DAOString = typeof mem[3] == 'string' ? mem[3].substring(mem[3].indexOf(",")) : "",
            lastVote = typeof mem[3] == 'string'
              ? Base64.toNumber(mem[3].split(",")[0])
              : json.block_num - parseInt(stats.spk_cycle_length * 4),
            thisVote =
              Base64.fromNumber(json.block_num) + "," + DAOString,
            ago = json.block_num - lastVote
          total = mem[1],
            power = mem[0]
          downs = Object.keys(mem[2])
          var effective_power = power, aValidator = false
          if (!stats.power_voted) stats.power_voted = {}
          if (stats.validators?.[from]) {
            aValidator = true
            var powerVoted = 0
            for (block of stats.power_voted) {
              powerVoted += stats.power_voted[block]
            }
            power = (total - powerVoted) / parseInt(stats.validators) //or number of validators
          }
          if (!power) {
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: `@${from}| Attempted SPK vote with no voting power`,
            });
            store.batch(ops, pc);
          } else if (downs.length && !aValidator) {
            getPathObj(['chrono', downs[0]]).then(down => {
              finish(down)
            })
          } else {
            finish()
          }
          function finish(down_obj) {
            if (down_obj?.amount) {
              effective_power = power - down_obj.amount
            }
            if (ago < parseInt(stats.spk_cycle_length * 4)) effective_power = parseInt(effective_power * (ago / parseInt(stats.spk_cycle_length * 4)))
            else if (ago > parseInt(stats.spk_cycle_length) && ago < parseInt(stats.spk_cycle_length * 4) * 2) effective_power = parseInt(
              effective_power *
              (1 - ((ago - parseInt(stats.spk_cycle_length * 4)) / parseInt(stats.spk_cycle_length * 4)) / 2)
            )
            else if (ago >= parseInt(stats.spk_cycle_length) * 2) effective_power = parseInt(effective_power / 2)

            const voteWeight = parseFloat(effective_power / total).toFixed(8)
            const decayWeight = parseFloat(1 - voteWeight).toFixed(8);
            //verify inputs, adjust constants
            //console.log({ decayWeight, voteWeight, total, effective_power })
            const votable = [
              "spk_cycle_length",
              "dex_fee",
              "dex_max",
              "dex_slope",
              "spk_rate_lpow",
              "spk_rate_ldel",
              "spk_rate_lgov",
              "max_coll_members",
              "broca_refill",
              "IPFSRate",
              "channel_bytes",
              "channel_min",
              //"liq_reward",
            ]
            var allowed = {}
            for (var i = 0; i < votable.length; i++) {
              if (!json[votable[i]]) allowed[votable[i]] = stats[votable[i]]
              //else if (typeof json[votable[i]] !== typeof stats[votable[i]]) allowed[votable[i]] = stats[votable[i]]
              else if (parseFloat(json[votable[i]]) > parseFloat(stats[votable[i]]) * 1.01) allowed[votable[i]] = parseFloat(stats[votable[i]]) * 1.01
              else if (parseFloat(json[votable[i]]) < parseFloat(stats[votable[i]]) * 0.99) allowed[votable[i]] = parseFloat(stats[votable[i]]) * 0.99
              else allowed[votable[i]] = json[votable[i]]
              allowed[votable[i]] = parseFloat(allowed[votable[i]]).toFixed(6)
              stats[votable[i]] = parseFloat((allowed[votable[i]] * voteWeight) + (decayWeight * parseFloat(stats[votable[i]]))).toFixed(6)
            }
            //useful-votes-calc
            if (!aValidator) stats.power_voted[stats.lastIBlock] = effective_power + (typeof stats.power_voted[stats.lastIBlock] == "number" ? stats.power_voted[stats.lastIBlock] : 0)
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
  },
  {
    type: "on",
    op: "spk_val_vote",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, getPathNum } = context
      var ops = []
      if (active) {
        var powp = getPathNum(["spow", from]),
          pstats = getPathObj(["stats"]),
          votebp = getPathObj(['spkVote', from]),
          valtotp = getPathObj(['val'])
        Promise.all([powp, votebp, valtotp])
          .then(mem => {
            var spk_power = mem[0],
              spkVote = mem[1],
              daoStringArr = typeof spkVote == "string" ? spkVote.split(',') : "",
              vals = mem[2],
              votes = json.votes || ''
            votes = votes.replace(/[^0-9A-Za-z+=]/g, '')
            if (votes.length > 60) votes = votes.substring(0, 59)
            if (spk_power) {
              vals = Validator.changeVote(vals, daoStringArr[1], votes, spk_power)
              const msg = `@${from}| VV:${json.votes}`;
              ops.push({
                type: "put",
                path: ['spkVote', from],
                data: `${daoStringArr[0] || ""},${votes}`,
              });
              ops.push({
                type: "put",
                path: ['val'],
                data: vals,
              });
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: msg,
              });
              store.batch(ops, pc);
            } else {
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: `@${from}| Attempted SPK vote without SPK`,
              });
              store.batch(ops, pc);
            }
          })
          .catch((e) => {
            console.log(e);
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
  },
  {
    type: "on",
    op: "shares_claim",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathNum, postToDiscord } = context
      let fbalp = getPathNum(['cbalances', from]),
        tbp = getPathNum(['balances', from]),
        pspk = getPathNum(['spk', from]),
        pcspk = getPathNum(['cspk', from])
      Promise.all([fbalp, tbp, pspk, pcspk])
        .then(mem => {
          let fbal = mem[0],
            tbal = mem[1],
            spk = mem[2],
            claimSpk = mem[3],
            ops = [],
            claim = parseInt(fbal);
          if (claim > 0) {
            const msg = `@${from}| Claimed: ${parseFloat(parseInt(claim) / 1000).toFixed(3)}${claimSpk ? ' ' : ''}${config.TOKEN} ${claimSpk ? parseFloat(parseInt(claimSpk) / 1000).toFixed(3) : ''} ${claimSpk ? 'SPK' : ''}`
            ops.push({ type: 'del', path: ['cbalances', from] });
            ops.push({ type: 'del', path: ['cspk', from] });
            ops.push({ type: 'put', path: ['spk', from], data: parseInt(claimSpk + spk) });
            ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + claim) });
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
          } else {
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid claim operation` });
          }
          if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
          store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
    }
  },
  {
    type: "on",
    op: "spk_shares_claim",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathNum, postToDiscord } = context
      let fbalp = getPathNum(['cbalances', from]),
        tbp = getPathNum(['balances', from]),
        pspk = getPathNum(['spk', from]),
        pcspk = getPathNum(['cspk', from])
      Promise.all([fbalp, tbp, pspk, pcspk])
        .then(mem => {
          let fbal = mem[0],
            tbal = mem[1],
            spk = mem[2],
            claimSpk = mem[3],
            ops = [],
            claim = parseInt(fbal);
          if (claim > 0) {
            const msg = `@${from}| Claimed: ${parseFloat(parseInt(claim) / 1000).toFixed(3)}${claimSpk ? ' ' : ''}${config.TOKEN} ${claimSpk ? parseFloat(parseInt(claimSpk) / 1000).toFixed(3) : ''} ${claimSpk ? 'SPK' : ''}`
            ops.push({ type: 'del', path: ['cbalances', from] });
            ops.push({ type: 'del', path: ['cspk', from] });
            ops.push({ type: 'put', path: ['spk', from], data: parseInt(claimSpk + spk) });
            ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + claim) });
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
          } else {
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid claim operation` });
          }
          if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
          store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
    }
  },
  {
    type: "on",
    op: "broca_shares_claim",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathNum, postToDiscord } = context
      let fbalp = getPathNum(['cbalances', from]),
        tbp = getPathNum(['balances', from]),
        pspk = getPathNum(['spk', from]),
        pcspk = getPathNum(['cspk', from])
      Promise.all([fbalp, tbp, pspk, pcspk])
        .then(mem => {
          let fbal = mem[0],
            tbal = mem[1],
            spk = mem[2],
            claimSpk = mem[3],
            ops = [],
            claim = parseInt(fbal);
          if (claim > 0) {
            const msg = `@${from}| Claimed: ${parseFloat(parseInt(claim) / 1000).toFixed(3)}${claimSpk ? ' ' : ''}${config.TOKEN} ${claimSpk ? parseFloat(parseInt(claimSpk) / 1000).toFixed(3) : ''} ${claimSpk ? 'SPK' : ''}`
            ops.push({ type: 'del', path: ['cbalances', from] });
            ops.push({ type: 'del', path: ['cspk', from] });
            ops.push({ type: 'put', path: ['spk', from], data: parseInt(claimSpk + spk) });
            ops.push({ type: 'put', path: ['balances', from], data: parseInt(tbal + claim) });
            if (config.hookurl || config.status) postToDiscord(msg, `${json.block_num}:${json.transaction_id}`)
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg });
          } else {
            ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: `@${from}| Invalid claim operation` });
          }
          if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
          store.batch(ops, pc);
        })
        .catch(e => { console.log(e); });
    }
  },
  {
    type: "on",
    op: "channel_open",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord, chronAssign, Base64 } = context
      const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
        if (typeof last != "string") last = '0,0'
        const last_calc = Base64.toNumber(last.split(',')[1])
        const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc)) / (pow * (stats.broca_daily_trend > 1000 ? stats.broca_daily_trend : 1000))) //revisit 
        var total = parseInt(last.split(',')[0]) + accured + add
        if (total > (pow * 1000)) total = (pow * 1000)
        return `${total},${Base64.fromNumber(bn)}`
      }
      if (json.to && json.broker) { //make this accept arrays of ops
        var Pbroca = getPathObj(["broca", from]);
        var Ppow = getPathNum(["bpow", from]);
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
          brocaString = broca_calc(broca, pow, stats, json.block_num),
            broca = parseInt(broca.split(',')[0])
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
              //console.log(ops)
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
            //console.log(ops)
            store.batch(ops, pc);
          }
        })
      } else {
        pc[0](pc[2]);
      }

    }
  },
  {
    type: "on",
    op: "channel_update",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, getPathNum, postToDiscord, chronAssign, Base64, Base58, stringify } = context
      const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
        if (typeof last != "string") last = '0,0'
        const last_calc = Base64.toNumber(last.split(',')[1])
        const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc)) / (pow * (stats.broca_daily_trend > 1000 ? stats.broca_daily_trend : 1000))) //revisit 
        var total = parseInt(last.split(',')[0]) + accured + add
        if (total > (pow * 1000)) total = (pow * 1000)
        return `${total},${Base64.fromNumber(bn)}`
      }
      function isValidMetadata(metadataString) {
        let metaData = metadataString.split(',')
        const contractData = metaData[0]
        const metadata = metaData.splice(1)
        if (metadata.length % 4 !== 0) return false
        let firstChar = contractData.split('')[0]
        if (firstChar == '#' || firstChar == '|') firstChar = "1"
        let simpleTest = Base64.toNumber(firstChar) + 1
        if (typeof simpleTest !== 'number') return false
        let encryptionData = contractData.split('#')
        encryptionData[encryptionData.length - 1] = encryptionData[encryptionData.length - 1].split('|')[0]
        encryptionData = encryptionData.splice(1)
        for (let i = 0; i < encryptionData.length; i++) {
          let key = encryptionData[i]
          if (key.endsWith(';')) key = key.substring(0, key.length - 1)
          let atIndex = key.indexOf('@')
          if (atIndex === -1) return false
          let cipher = key.substring(0, atIndex)
          if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(cipher)) return false
          let account = key.substring(atIndex + 1)
          if (!/^[a-z0-9-.]{1,16}$/.test(account)) return false
        }
        let folderData = contractData.split('|')
        folderData = folderData.splice(1)
        if (folderData.length > 48) return false
        let folderIndexMap = new Map()
        folderIndexMap.set(0, "Root")
        let k = 1
        for (var l = 2; l < 10; l++) {
          folderIndexMap.set(l, l)
        }
        for (let i = 0; i < folderData.length; i++) {
          let folderPath = folderData[i]
          let pathParts = folderPath.split('/')
          for (let j = 0; j < pathParts.length; j++) {
            let part = pathParts[j]
            if (j < pathParts.length - 1) {
              if (!part.match(/^[0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/))
                return false
              let parentIndex = Base58.toNumber(part);
              if (!folderIndexMap.has(parentIndex)) return false
            } else {
              if (!part.match(/^[0-9a-zA-Z+_.\- ]{2,16}$/)) return false
              folderIndexMap.set(k, folderPath)
              if (k == 1) {
                k = 9
              }
              k++
            }
          }
        }

        if (!validateFileMetadata(metadata, folderIndexMap)) return false
        return true
        function validateFileMetadata(metadataStr, folderIndexMap) {
          const fileEntries = [];
          for (let i = 0; i < metadataStr.length; i += 4) {
            if (i + 4 <= metadataStr.length) {
              fileEntries.push(metadataStr.slice(i, i + 4));
            } else return false
          }
          const namePattern = /^[^,]{1,32}$/u
          const typePattern = /^[a-z0-9]{0,4}(?:\.[0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)?$/
          const ipfsPattern = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/
          const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/
          const flagsPattern = /^([0-9a-zA-Z+/=]?)-([0-9a-zA-Z+/=]?)-([0-9a-zA-Z+/=]*)$/
          for (let i = 0; i < fileEntries.length; i++) {
            const entry = fileEntries[i];
            if (entry.length !== 4) return false;
            const [name, type, thumb, flagsCombined] = entry
            if (!namePattern.test(name)) return false
            if (!typePattern.test(type)) return false
            const typeParts = type.split('.');
            if (typeParts.length > 1 && !folderIndexMap.has(Base58.toNumber(typeParts[1])) && typeParts[1] != "0") return false
            if (thumb && !ipfsPattern.test(thumb) && !urlPattern.test(thumb)) return false
            if (flagsCombined && !flagsPattern.test(flagsCombined)) return false
          }
          return true
        }
      }
      function process_complete_update(json, from, active) {
        return new Promise((resolve, reject) => {
          if (active && json.fo && json.f && json.id && json.co === from) {
            var Pbroca = getPathObj(["broca", json.f]);
            var Ppow = getPathNum(["bpow", json.f]);
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
                var cids = json.c.split(',');
                proffer.m = stringify("1")
                const metadata_size_verification = (cids.length * 4 + 1)
                let metadata_size = 0
                try {
                  metadata_size = json.m.split(',').length
                } catch (e) {
                  console.log("Error parsing metadata:", e);
                }
                if (json.m && typeof json.m === 'string' && isValidMetadata(json.m) && metadata_size == metadata_size_verification) {
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
                          data: proffer,
                        })
                        ops.push({
                          type: "put",
                          path: ["cPointers", json.id],
                          data: json.fo
                        })
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
                          data: proffer,
                        })
                        ops.push({
                          type: "put",
                          path: ["cPointers", json.id],
                          data: json.fo
                        })
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
  },
  {
    type: "on",
    op: "contract_close",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, postToDiscord } = context
      if (json?.id.indexOf(':') > 0) {
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
              //console.log('refund calc:', exts[0], exts[1], stats, json.block_num)
              //console.log(refunds)
              for (var account in refunds) {
                //console.log({ account }, exts[refunds[account].i + 1], exts[refunds[account].i + 1], stats, json.block_num, refunds[account].a)
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
    }
  },
  {
    type: "on",
    op: "update_metadata",
    func: function (json, from, active, pc, context) {
      const { store, config, getPathObj, postToDiscord, Base58 } = context
      function isValidMetadata(metadataString) {
        let metaData = metadataString.split(',')
        const contractData = metaData[0]
        const metadata = metaData.splice(1)
        if (metadata.length % 4 !== 0) return false
        let firstChar = contractData.split('')[0]
        if (firstChar == '#' || firstChar == '|') firstChar = "1"
        let simpleTest = Base64.toNumber(firstChar) + 1
        if (typeof simpleTest !== 'number') return false
        let encryptionData = contractData.split('#')
        encryptionData[encryptionData.length - 1] = encryptionData[encryptionData.length - 1].split('|')[0]
        encryptionData = encryptionData.splice(1)
        for (let i = 0; i < encryptionData.length; i++) {
          let key = encryptionData[i]
          if (key.endsWith(';')) key = key.substring(0, key.length - 1)
          let atIndex = key.indexOf('@')
          if (atIndex === -1) return false
          let cipher = key.substring(0, atIndex)
          if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(cipher)) return false
          let account = key.substring(atIndex + 1)
          if (!/^[a-z0-9-.]{1,16}$/.test(account)) return false
        }
        let folderData = contractData.split('|')
        folderData = folderData.splice(1)
        if (folderData.length > 48) return false
        let folderIndexMap = new Map()
        folderIndexMap.set(0, "Root")
        let k = 1
        for (var l = 2; l < 10; l++) {
          folderIndexMap.set(l, l)
        }
        for (let i = 0; i < folderData.length; i++) {
          let folderPath = folderData[i]
          let pathParts = folderPath.split('/')
          for (let j = 0; j < pathParts.length; j++) {
            let part = pathParts[j]
            if (j < pathParts.length - 1) {
              if (!part.match(/^[0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/))
                return false
              let parentIndex = Base58.toNumber(part);
              if (!folderIndexMap.has(parentIndex)) return false
            } else {
              if (!part.match(/^[0-9a-zA-Z+_.\- ]{2,16}$/)) return false
              folderIndexMap.set(k, folderPath)
              if (k == 1) {
                k = 9
              }
              k++
            }
          }
        }

        if (!validateFileMetadata(metadata, folderIndexMap)) return false
        return true
        function validateFileMetadata(metadataStr, folderIndexMap) {
          const fileEntries = [];
          for (let i = 0; i < metadataStr.length; i += 4) {
            if (i + 4 <= metadataStr.length) {
              fileEntries.push(metadataStr.slice(i, i + 4));
            } else return false
          }
          const namePattern = /^[^,]{1,32}$/u
          const typePattern = /^[a-z0-9]{0,4}(?:\.[0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)?$/
          const ipfsPattern = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/
          const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/
          const flagsPattern = /^([0-9a-zA-Z+/=]?)-([0-9a-zA-Z+/=]?)-([0-9a-zA-Z+/=]*)$/
          for (let i = 0; i < fileEntries.length; i++) {
            const entry = fileEntries[i];
            if (entry.length !== 4) return false;
            const [name, type, thumb, flagsCombined] = entry
            if (!namePattern.test(name)) return false
            if (!typePattern.test(type)) return false
            const typeParts = type.split('.');
            if (typeParts.length > 1 && !folderIndexMap.has(Base58.toNumber(typeParts[1])) && typeParts[1] != "0") return false
            if (thumb && !ipfsPattern.test(thumb) && !urlPattern.test(thumb)) return false
            if (flagsCombined && !flagsPattern.test(flagsCombined)) return false
          }
          return true
        }
      }
      function handleSingleUpdate(json, from, ops, errors) {
        return Promise.all([
          getPathObj(["contract", from, json.id]),
          getPathObj(["partial_metadata_updates", json.id.split(':')[2]])
        ])
          .then(([contract, partial]) => {
            if (!contract || !contract.e) {
              errors.push(`Contract ${json.id} not found or not editable`)
              return
            }
            if (from !== contract.t) {
              errors.push(`Unauthorized edit attempt for contract ${json.id}`)
              return
            }
            const metadata_size_verification = (Object.keys(contract.df).length * 4 + 1)
            if (json.chunk_data && json.chunk_id && json.total_chunks) {
              const chunk_id = json.chunk_id
              const total_chunks = json.total_chunks
              const chunk_data = json.chunk_data
              if (!partial) partial = { total_chunks, from, chunks: {} }
              else if (partial.from !== from || partial.total_chunks !== total_chunks) {
                errors.push(`Chunk mismatch for contract ${json.id}`)
                return
              }
              partial.chunks[chunk_id] = chunk_data
              if (Object.keys(partial.chunks).length === total_chunks) {
                let complete_metadata = ""
                for (let i = 1; i <= total_chunks; i++) {
                  if (!partial.chunks[i]) {
                    errors.push(`Missing chunk ${i} for contract ${json.id}`)
                    return
                  }
                  complete_metadata += partial.chunks[i];
                }
                if (!isValidMetadata(complete_metadata) || complete_metadata.split(',').length !== metadata_size_verification) {
                  errors.push(`Invalid metadata format or size for contract ${json.id}`)
                  ops.push({
                    type: "del",
                    path: ["partial_metadata_updates", json.id.split(':')[2]]
                  });
                  return
                }
                contract.m = complete_metadata
                ops.push({
                  type: "del",
                  path: ["partial_metadata_updates", json.id.split(':')[2]]
                })
                if (config.hookurl || config.status) {
                  postToDiscord(`${from} updated metadata for ${json.id} via chunks`, `${json.block_num}:${json.transaction_id}`)
                }
              } else {
                ops.push({
                  type: "put",
                  path: ["partial_metadata_updates", json.id.split(':')[2]],
                  data: partial
                })
                return
              }
            } else if (json.m && typeof json.m === "string") {
              if (!isValidMetadata(json.m) || json.m.split(',').length !== metadata_size_verification) {
                errors.push(`Invalid metadata format or size for contract ${json.id}`);
                return
              }
              contract.m = json.m
              if (config.hookurl || config.status) {
                postToDiscord(`${from} updated metadata for ${json.id}`, `${json.block_num}:${json.transaction_id}`)
              }
            } else if (json.diff && typeof json.diff === "string") {
              const newMetadata = jsdiff.applyPatch(contract.m, json.diff)
              if (newMetadata === false) {
                errors.push(`Failed to apply diff for contract ${json.id}`)
                return
              }
              if (!isValidMetadata(newMetadata) || newMetadata.split(',').length !== metadata_size_verification) {
                errors.push(`Invalid metadata format or size after diff for contract ${json.id}`);
                return
              }
              contract.m = newMetadata
              if (config.hookurl || config.status) {
                postToDiscord(`${from} updated metadata for ${json.id} via diff`, `${json.block_num}:${json.transaction_id}`)
              }
            } else {
              errors.push(`Invalid update request for contract ${json.id}`)
              return
            }
            ops.push({
              type: "put",
              path: ["contract", from, json.id],
              data: contract
            })
          })
          .catch((e) => {
            console.log("Error in handleSingleUpdate:", e)
            errors.push(`Error processing contract ${json.id}`)
          })
      }
      function handleMultipleUpdates(updates, from, ops, errors, json) {
        const contractIds = Object.keys(updates)
        const contractPaths = contractIds.map((id) => getPathObj(["contract", from, id]))
        return Promise.all(contractPaths)
          .then((contracts) => {
            contracts.forEach((contract, i) => {
              const contractId = contractIds[i]
              const update = updates[contractId]
              if (!contract || !contract.e) {
                errors.push(`Contract ${contractId} not found or not editable`)
                return
              }
              if (from !== contract.t) {
                errors.push(`Unauthorized edit attempt for contract ${contractId}`)
                return
              }
              const metadata_size_verification = (Object.keys(contract.df).length * 4 + 1)
              if (update.m && typeof update.m === "string") {
                if (!isValidMetadata(update.m) || update.m.split(',').length !== metadata_size_verification) {
                  errors.push(`Invalid metadata format or size for contract ${contractId}`);
                  //console.log(!isValidMetadata(update.m), update.m.split(',').length, metadata_size_verification)
                  return
                }
                contract.m = update.m
                if (config.hookurl || config.status) {
                  postToDiscord(`${from} updated metadata for ${contractId}`, `${json.block_num}:${json.transaction_id}`)
                }
              } else if (update.diff && typeof update.diff === "string") {
                const newMetadata = jsdiff.applyPatch(contract.m, update.diff)
                if (!isValidMetadata(newMetadata) || newMetadata.split(',').length !== metadata_size_verification) {
                  errors.push(`Invalid metadata format or size for contract ${contractId}`);
                  //console.log(!isValidMetadata(newMetadata), newMetadata.split(',').length, metadata_size_verification)
                  return
                }
                if (newMetadata === false) {
                  errors.push(`Failed to apply diff for contract ${contractId}`)
                  return
                }
                contract.m = newMetadata
                if (config.hookurl || config.status) {
                  postToDiscord(`${from} updated metadata for ${contractId} via diff`, `${json.block_num}:${json.transaction_id}`)
                }
              } else {
                errors.push(`Invalid update for contract ${contractId}`)
                return
              }
              ops.push({
                type: "put",
                path: ["contract", from, contractId],
                data: contract
              })
            })
          })
          .catch((e) => {
            console.log("Error in handleMultipleUpdates:", e)
            errors.push("Error processing multiple updates")
          });
      }
      const ops = []
      const errors = []
      let updatePromise
      if (json.id) {
        updatePromise = handleSingleUpdate(json, from, ops, errors);
      } else if (json.updates && typeof json.updates === "object") {
        updatePromise = handleMultipleUpdates(json.updates, from, ops, errors, json);
      } else {
        pc[0](pc[2]);
        return;
      }
      updatePromise
        .then(() => {
          if (errors.length > 0) {
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: `Errors: ${errors.join("; ")}`
            });
          } else {
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: `Updated metadata for contracts: ${Object.keys(json.updates || { [json.id]: true }).join(", ")}`
            });
          }
          if (process.env.npm_lifecycle_event === "test") pc[2] = ops;
          store.batch(ops, pc);
        })
        .catch((e) => {
          console.log("Error in update_metadata:", e);
          pc[0](pc[2]);
        });

    }
  },
  {
    type: "on",
    op: "delete_files",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, Base64 } = context
      const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
        if (typeof last != "string") last = '0,0'
        const last_calc = Base64.toNumber(last.split(',')[1])
        const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc)) / (pow * (stats.broca_daily_trend > 1000 ? stats.broca_daily_trend : 1000))) //revisit 
        var total = parseInt(last.split(',')[0]) + accured + add
        if (total > (pow * 1000)) total = (pow * 1000)
        return `${total},${Base64.fromNumber(bn)}`
      }
      function calculateRefunds(deletedFilesByContract, block_num, from) {
        return new Promise(resolve => {
          const ops = []
          const accountPromises = []
          for (const contractId in deletedFilesByContract) {
            const { contract, totalDeletedBytes, originalTotalBytes } = deletedFilesByContract[contractId]
            const proportionDeleted = totalDeletedBytes / originalTotalBytes
            const extensions = contract.ex ? contract.ex.split(",") : []
            const refundsByAccount = {}
            extensions.forEach(ext => {
              const [account, amount, period] = ext.split(":")
              const [start, end] = period.split("-").map(Number)
              if (end > block_num) {
                const remainingBlocks = end - Math.max(start, block_num)
                const totalBlocks = end - start
                const refundAmount = parseInt(amount * proportionDeleted * (remainingBlocks / totalBlocks))
                if (refundAmount > 0) {
                  refundsByAccount[account] = (refundsByAccount[account] || 0) + refundAmount
                }
              }
            })
            for (const account in refundsByAccount) {
              const refundAmount = refundsByAccount[account]
              accountPromises.push(
                Promise.all([
                  getPathObj(["broca", account]),
                  getPathObj(["bpow", account]),
                  getPathObj(["stats"])
                ]).then(([broca, bpow, stats]) => {
                  const updatedBroca = broca_calc(broca, bpow, stats, block_num, refundAmount);
                  ops.push({
                    type: "put",
                    path: ["broca", account],
                    data: updatedBroca
                  })
                })
              )
            }
          }
          Promise.all(accountPromises).then(() => {
            resolve(ops)
          })
        })
      }
      if (!Array.isArray(json.cids)) {
        pc[0](pc[2])
        return
      }
      const cids = json.cids
      let contractObject = {}
      const Pipfs = cids.map(cid => getPathObj(["IPFS", cid]))
      Promise.all(Pipfs).then(ipfsEntries => {
        const contractInfos = ipfsEntries.map((entry, i) => {
          if (entry && typeof entry === "string") {
            const [owner, contractId] = entry.split(",")
            return { cid: cids[i], owner, contractId }
          }
          return null
        }).filter(Boolean)
        const uniqueContracts = [...new Set(contractInfos.map(info => info.contractId))]
        const Pcontracts = uniqueContracts.map(id => getPathObj(["contract", from, id]))
        const Pstats = getPathObj(["stats"])
        Promise.all([...Pcontracts, Pstats]).then(mem => {
          const contracts = mem.slice(0, uniqueContracts.length)
          const stats = mem[mem.length - 1]
          const ops = []
          const errors = []
          const deletedFilesByContract = {}
          contracts.forEach(contract => {
            if (contract.t !== from) {
              errors.push(`Not authorized to delete from contract ${contract.i}`)
              return
            }
            let totalDeletedBytes = 0
            const deletedCids = []
            const sortedCids = Object.keys(contract.df).sort()
            const metadataFields = contract.m.split(',')
            const expectedFieldCount = 4 * sortedCids.length + 1
            for (const cid of cids) {
              if (contract.df[cid]) {
                const bytes = contract.df[cid]
                totalDeletedBytes += bytes
                delete contract.df[cid]
                deletedCids.push(cid)
                ops.push({ type: "del", path: ["IPFS", cid] })
              }
            }
            if (deletedCids.length > 0) {
              const originalTotalBytes = contract.u
              contract.u -= totalDeletedBytes
              if (metadataFields.length === expectedFieldCount) {
                const indicesToRemove = []
                for (const cid of deletedCids) {
                  const index = sortedCids.indexOf(cid)
                  if (index !== -1) {
                    const startIndex = 1 + index * 4;
                    for (let i = 0; i < 4; i++) {
                      indicesToRemove.push(startIndex + i)
                    }
                  }
                }
                indicesToRemove.sort((a, b) => b - a)
                for (const index of indicesToRemove) {
                  metadataFields.splice(index, 1)
                }
                contract.m = metadataFields.join(',')
              }
              stats.total_bytes -= totalDeletedBytes
              stats.total_files -= deletedCids.length
              deletedFilesByContract[contract.i] = { contract, totalDeletedBytes, originalTotalBytes }
            }
            contractObject[contract.i] = contract
          })
          calculateRefunds(deletedFilesByContract, json.block_num, from).then(refundOps => {
            ops.push(...refundOps)
            for (const contractId in deletedFilesByContract) {
              const { contract } = deletedFilesByContract[contractId];
              if (Object.keys(contract.df).length > 0) {
                ops.push({ type: "put", path: ["contract", from, contractId], data: contract });
              } else {
                ops.push({ type: "del", path: ["contract", from, contractId] });
              }
            }
            ops.push({ type: "put", path: ["stats"], data: stats })
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: errors.length > 0 ? `Errors: ${errors.join("; ")}` : `Deleted files: ${cids.join(", ")}`
            })
            if (process.env.npm_lifecycle_event === "test") pc[2] = ops;
            store.batch(ops, pc);
          }).catch(e => {
            pc[0](pc[2])
          });
        }).catch(e => {
          pc[0](pc[2])
        });
      }).catch(e => {
        pc[0](pc[2])
      })
    }
  },
  {
    type: "on",
    op: "store",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, Base64, postToDiscord, config } = context
      if (json.items.length) {
        var promises = []
        for (var i = 0; i < json.items.length; i++) {
          promises.push(getPathObj(["cPointers", json.items[i]]))
        }
        promises.push(getPathObj(["services", from, 'IPFS']), getPathObj(["authorities", from]))
        Promise.all(promises).then(contractPointers => {
          const services = contractPointers[json.items.length]
          const PubKey = contractPointers[json.items.length + 1]
          if (typeof PubKey == 'string' && Object.keys(services).length) { //ensure user has valid registered node to prevent spam
            promises = []
            for (var i = 0; i < json.items.length; i++) {
              if (typeof contractPointers[i] == "string") {
                promises.push(getPathObj(["contract", contractPointers[i], json.items[i]]))
              }
            }
            Promise.all(promises).then(contracts => {
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
  },
  {
    type: "on",
    op: "extend",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, Base64, postToDiscord, config, getPathNum, chronAssign } = context
      const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
        if (typeof last != "string") last = '0,0'
        const last_calc = Base64.toNumber(last.split(',')[1])
        const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc)) / (pow * (stats.broca_daily_trend > 1000 ? stats.broca_daily_trend : 1000))) //revisit 
        var total = parseInt(last.split(',')[0]) + accured + add
        if (total > (pow * 1000)) total = (pow * 1000)
        return `${total},${Base64.fromNumber(bn)}`
      }
      if (json.broca && json.id && json.file_owner) {
        var Pbroca = getPathObj(["broca", from]);
        var Ppow = getPathNum(["bpow", from])
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
            let cidsSorted = Object.keys(contract.df).sort()
            let cidsMetaData = []
            let cidsFlaggedForDeletion = []
            try {
              cidsMetaData = contract.m.split(',').splice(1)
            } catch (e) {
              console.log("Error parsing metadata:", e);
            }
            for (var i = 0; i < cidsMetaData.length; i++) {
              if (cidsMetaData[(i * 4) + 1] && cidsMetaData[(i * 4) + 1].split('.').length > 1 && cidsMetaData[(i * 4) + 1].split('.')[1] == "8") {
                cidsFlaggedForDeletion.push(cidsSorted[i])
              }
            }
            let deletePromise = new Promise((resolve, reject) => {
              if (cidsFlaggedForDeletion.length) {
                exports.delete_files({ cids: cidsFlaggedForDeletion, block_num: json.block_num, transaction_id: json.transaction_id }, contract.t, true, [resolve, reject, 0])
              } else {
                resolve([])
              }
            })
            deletePromise.then(contracts => {
              if (contracts.length) {
                contract = contracts[contracts.i]
              }
              if (from == contract.t && parseInt(json.power) > 0) {
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
                //console.log(ops)
                store.batch(ops, pc);
              })
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
  },
  {
    type: "on",
    op: "remove",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, Base64, postToDiscord, config } = context
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
                //console.log(contract)
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
  },
  {
    type: "on",
    op: "register_authority",
    func: function (json, from, active, pc, context) {
      const { store, postToDiscord, config } = context
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
    }
  },
  {
    type: "on",
    op: "validator_burn",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, getPathNum, Base64, postToDiscord, config } = context
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
          if (config.mode == 'verbose') console.log('Threshhold', parseFloat(stats.IPFSRate) * (1 + Base64.toNumber(stats.validators_registered.split('')[0])))
          if (
            (burn >= parseFloat(stats.IPFSRate) * (1 + Base64.toNumber(stats.validators_registered.split('')[0])) || node.val_code) && //fee to register validator node with increase every 64 registrations
            fbal >= burn &&
            node.self == from &&
            active
          ) {
            var msg = `@${from}| Burned ${parseFloat(
              burn / 1000
            ).toFixed(3)} LARYNX to their validator`;
            if (!node.burned) {
              var next_code = Base64.fromNumber(Base64.toNumber(stats.validators_registered) + 1)
              if (next_code.split('').length == 1) next_code = "0" + next_code
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
              data: node
            });
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
    }
  },
  {
    type: "on",
    op: "register_service",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, getPathNum, Base64, postToDiscord, config, stringify } = context
      if (typeof json.type == "string") json.type = json.type.toUpperCase()
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
            json.id.length < 256 &&
            json.id &&
            send >= stats.IPFSRate &&
            fbal >= send &&
            active &&
            !services?.[json.type]?.[json.id]
          ) {
            const memo = json.memo && json.memo.length < 256 ? stringify(json.memo) : ''
            ops.push({
              type: "put",
              path: ["services", from, json.type, json.id],
              data: {
                a: json.api, //api
                i: json.id, //ipfs peerID
                m: memo, //additional information
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
            if (!Object.keys(accountStats).length) accountStats = {
              i: json.id, //ipfs peerID
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
              if (accountStats.i.indexOf(json.id) == -1) accountStats.i = accountStats.i + `,${json.type}:${json.id}`
            }
            ops.push({
              type: "put",
              path: ["services", from, 's'],
              data: accountStats,
            })
            var refAccountString = ''
            if (typeof refByAccount == "string") refAccountString = `${refByAccount},${json.id}`
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
          ) {
            services[json.type][json.id].c += send
            if (json.memo && json.memo.length < 256) services[json.type][json.id].m = stringify(json.memo)
            if (json.api && json.api.length < 256) services[json.type][json.id].a = json.api
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
    }
  },
  {
    type: "on",
    op: "register_service_type",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, getPathNum, postToDiscord, config } = context
      if (typeof json.type == "string") json.type = json.type.toUpperCase()
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
  },
  {
    type: "on",
    op: "spk_dex_sell",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, getPathNum, postToDiscord, config, DEX, stringify, hashThis, chronAssign, addMT } = context
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
            clawback = 0,
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
              //console.log({ json, item, price, order });
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
                    if (stats.broca_clawback) {
                      newClawback = parseInt(next.amount * stats.broca_clawback / 10000)
                      clawback += newClawback
                      next.amount -= newClawback
                    }
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
                    stats.multiSigCollateralValue = stats.multiSigCollateral * dex.tick
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
                    ).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from
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
                      path: ["stats"],
                      data: stats,
                    })
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
                  if (stats.broca_clawback) {
                    newClawback = parseInt((remaining / next.amount) * stats.broca_clawback / 10000)
                    clawback += newClawback
                    next.amount -= newClawback
                  }
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
                    stats.multiSigCollateralValue = stats.multiSigCollateral * dex.tick
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
                    ).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from
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
                      path: ["stats"],
                      data: stats,
                    })
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
            ops.push({
              type: "put",
              path: ["stats"],
              data: stats,
            })
            ops.push({ type: "put", path: ["spk", from], data: bal });
            ops.push({ type: "put", path: ["dexs", order.pair], data: dex });
            if (Object.keys(his).length)
              ops.push({
                type: "put",
                path: ["dexs", order.pair, "his"],
                data: his,
              });
            const burnSpk = (node, amount = 0) => {
              return new Promise((resolve, reject) => {
                store.get(['spk', 't'], function (e, a) {
                  if (!e) {
                    const a2 = typeof a != 'number' ? amount : a - amount
                    store.batch([{ type: 'put', path: ['spk', node], data: a2 }], [resolve, reject, 1])
                  } else {
                    console.log(e)
                  }
                })
              })
            }
            var someadds = [addMT(["spk", "u"], fee), burnSpk(clawback)];
            Promise.all(someadds).then((empty) => {
              addop(0, addops);
            });
            function addop(i, a) {
              var keys = Object.keys(a);
              if (i < keys.length) {
                addMT(["spk", keys[i]], a[keys[i]]).then((empty) => {
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
                  ).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid
                    })`;
                  ops.push({
                    type: "put",
                    path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
                    data: msg,
                  });
                  ops.push({
                    type: "put",
                    path: ["stats"],
                    data: stats,
                  })
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
    }
  },
  {
    type: "on",
    op: "spk_dex_clear",
    func: function (json, from, active, pc, context) {
      const { store, isEmpty, release } = context
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
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexs', 'spk')
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
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexs', 'spk')
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
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexs', 'spk')
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
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexs', 'spk')
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
    }
  },
  {
    type: "on",
    op: "broca_dex_sell",
    func: function (json, from, active, pc, context) {
      const { store, getPathObj, getPathNum, postToDiscord, config, DEX, stringify, hashThis, chronAssign, addMT } = context
      let PfromBal = getPathNum(["lbroca", from]),
        PStats = getPathObj(["stats"]),
        PSB = getPathObj(["dexb", "hive"]),
        order = {};
      if (parseInt(json.hive)) {
        order.type = "LIMIT";
        order.target = parseInt(json.hive);
        order.rate = parseFloat(
          parseInt(json.hive) / parseInt(json["broca"])
        ).toFixed(6);
        order.pair = "hive";
      } else if (parseInt(json.hbd)) {
        PSB = getPathObj(["dexb", "hbd"]);
        order.type = "LIMIT";
        order.pair = "hbd";
        order.target = parseInt(json.hbd);
        order.rate = parseFloat(
          parseInt(json.hbd) / parseInt(json["broca"])
        ).toFixed(6);
      } else if (json.pair == "HBD") {
        PSB = getPathObj(["dexb", "hbd"]);
        order.type = "MARKET";
        order.pair = "hbd";
      } else {
        order = {
          type: "MARKET",
          pair: "hive",
          amount: json["broca"],
        };
      }
      if (parseFloat(order.rate) < 0) {
        (order.type = "MARKET"), delete order.rate;
      }
      order["broca"] = parseInt(json["broca"]);
      Promise.all([PfromBal, PStats, PSB])
        .then((a) => {
          let bal = a[0],
            stats = a[1],
            dex = a[2],
            ops = [],
            adds = [],
            his = {},
            fee = 0,
            clawback = 0,
            hours = parseInt(json.hours) || 720;
          if (hours > 720) {
            hours = 720;
          }
          const expBlock = json.block_num + hours * 1200;
          if (
            order["broca"] <= bal &&
            order["broca"] >= 4 &&
            active
          ) {
            let remaining = json["broca"],
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
              //console.log({ json, item, price, order });
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
                    if (stats.broca_clawback) {
                      newClawback = parseInt(next.amount * stats.broca_clawback / 10000)
                      clawback += newClawback
                      next.amount -= newClawback
                    }
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
                    ).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from
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
                        "dexb",
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
                        "dexb",
                        order.pair,
                        "buyOrders",
                        `${price.toFixed(6)}:${item}`,
                      ],
                    }); //remove the order
                    ops.push({ type: "del", path: ["contracts", next.from, item] }); //remove the contract
                    ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
                  }
                } else {
                  if (stats.broca_clawback) {
                    newClawback = parseInt((remaining / next.amount) * stats.broca_clawback / 10000)
                    clawback += newClawback
                    next.amount -= newClawback
                  }
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
                    ).toFixed(3)} ${order.pair.toUpperCase()} to ${next.from
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
                      op: "expireb",
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
            bal -= json["broca"];
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
            ops.push({ type: "put", path: ["lbroca", from], data: bal });
            ops.push({ type: "put", path: ["dexb", order.pair], data: dex });
            if (Object.keys(his).length)
              ops.push({
                type: "put",
                path: ["dexb", order.pair, "his"],
                data: his,
              });
            const burnlbroca = (node, amount = 0) => {
              return new Promise((resolve, reject) => {
                store.get(['lbroca', 't'], function (e, a) {
                  if (!e) {
                    const a2 = typeof a != 'number' ? amount : a - amount
                    store.batch([{ type: 'put', path: ['lbroca', node], data: a2 }], [resolve, reject, 1])
                  } else {
                    console.log(e)
                  }
                })
              })
            }
            var someadds = [addMT(["lbroca", "u"], fee), burnlbroca(clawback)];
            Promise.all(someadds).then((empty) => {
              addop(0, addops);
            });
            function addop(i, a) {
              var keys = Object.keys(a);
              if (i < keys.length) {
                addMT(["lbroca", keys[i]], a[keys[i]]).then((empty) => {
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
                  ).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid
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
    }
  },
  {
    type: "on",
    op: "broca_dex_clear",
    func: function (json, from, active, pc, context) {
      const { store, isEmpty, release } = context
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
                    ["dexb", "hive", "sellOrders", `${b.rate}:${b.txid}`],
                    function (e, a) {
                      if (e) {
                        pc[0](pc[2]);
                      } else if (isEmpty(a)) {
                        console.log("Nothing here" + b.txid);
                      } else {
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexb', 'lbroca')
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
                    ["dexb", "hbd", "sellOrders", `${b.rate}:${b.txid}`],
                    function (e, a) {
                      if (e) {
                        pc[0](pc[2]);
                      } else if (isEmpty(a)) {
                        console.log("Nothing here" + b.txid);
                      } else {
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexb', 'lbroca')
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
                    ["dexb", "hive", "buyOrders", `${b.rate}:${b.txid}`],
                    function (e, a) {
                      if (e) {
                        pc[0](pc[2]);
                      } else if (isEmpty(a)) {
                        console.log("Nothing here" + b.txid);
                      } else {
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexb', 'lbroca')
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
                    ["dexb", "hbd", "buyOrders", `${b.rate}:${b.txid}`],
                    function (e, a) {
                      if (e) {
                        pc[0](pc[2]);
                      } else if (isEmpty(a)) {
                        console.log("Nothing here" + b.txid);
                      } else {
                        release(from, b.txid, json.block_num, json.transaction_id, 'dexb', 'lbroca')
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
    }
  }
]

const CustomOperationsProcessing = [
  {
    type: "onOperation",
    op: "transfer",
    func: function (json, pc, context) {
      const { store, config, getPathObj, getPathNum, add, addMT, addCol, addGov, deletePointer, credit, chronAssign, hashThis, isEmpty, naizer } = context
      json = naizer(json);
      const burnBroca = (node, amount = 0) => {
        return new Promise((resolve, reject) => {
          store.get(['lbroca', 't'], function (e, a) {
            if (!e) {
              const a2 = typeof a != 'number' ? amount : a - amount
              store.batch([{ type: 'put', path: ['lbroca', node], data: a2 }], [resolve, reject, 1])
            } else {
              console.log(e)
            }
          })
        })
      }
      const addBroca = (node, amount) => {
        return new Promise((resolve, reject) => {
          store.get(['lbroca', node], function (e, a) {
            if (!e) {
              //console.log(amount + ' to ' + node)
              const a2 = typeof a != 'number' ? amount : a + amount
              //console.log('final balance ' + a2)
              store.batch([{ type: 'put', path: ['lbroca', node], data: a2 }], [resolve, reject, 1])
            } else {
              console.log(e)
            }
          })
        })
      }
      const addSpk = (node, amount) => {
        return new Promise((resolve, reject) => {
          store.get(['spk', node], function (e, a) {
            if (!e) {
              //console.log(amount + ' to ' + node)
              const a2 = typeof a != 'number' ? amount : a + amount
              //console.log('final balance ' + a2)
              store.batch([{ type: 'put', path: ['spk', node], data: a2 }], [resolve, reject, 1])
            } else {
              console.log(e)
            }
          })
        })
      }
      if (
        config.features.ico &&
        json.to == config.msaccount &&
        json.amount.nai == "@@000000021" &&
        json.from != config.msaccount &&
        json.memo == 'AUCTION'
      ) {
        const amount = parseInt(json.amount.amount);
        var clawback = 0;
        var purchase,
          Pstats = getPathObj(["stats"]),
          Pbal = getPathNum(["auction", json.from])
        Promise.all([Pstats, Pbal]).then(function (v) {
          var stats = v[0],
            bal = v[1] + amount
          ops = [];
          if (!stats.inAuction) stats.inAuction = 0
          stats.inAuction += amount
          const msg = `@${json.from}| placed ${parseFloat(
            amount / 1000
          ).toFixed(3)} HIVE into daily auction.`;
          if (config.hookurl || config.status)
            postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
          ops = [
            {
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}`],
              data: msg,
            },
            { type: "put", path: ["auction", json.from], data: bal },
            { type: "put", path: ["stats"], data: stats },
          ];
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        });
      } else if (
        (config.features.dex || config.features.nft) &&
        json.to == config.msaccount &&
        json.from != config.mainICO
      ) {
        if (
          json.memo.split(" ").length > 1 &&
          json.memo.split(" ")[0] == "NFT"
        ) {
          /*
                        lth[`set:hash`]{
                            h,//millihive
                            b,//millihbd
                            q,//qty
                            d,//distro string
                            i:`${json.set}:${hash}`,//item for canceling
                            e:'pb:startdate_enddate,max:3',
                            s:'account1_1,account2_2,account3_1',
                            p,//pending sales 
                        }
                */
          let item = json.memo.split(" ")[1],
            setname = item.split(":")[0],
            Pset = getPathObj(["sets", setname]),
            Pstats = getPathObj(["stats"]),
            Pitem = getPathObj(["lth", item]);
          Promise.all([Pset, Pitem, Pstats]).then((mem) => {
            let set = mem[0],
              listing = mem[1],
              stats = mem[2],
              amount = parseInt(json.amount.amount),
              type = json.amount.nai == "@@000000021" ? "HIVE" : "HBD",
              ops = [],
              qty = 0,
              refund_amount = amount,
              transfers = [],
              enf = enforce(listing.e),
              allowed = 9999999,
              whoBoughtIndex,
              whoBoughtAmount = 0;
            stats.MSHeld[type] += refund_amount;
            if (listing) {
              if (!listing.s) listing.s = "";
              if (enf.max) {
                allowed = enf.max;
                whoBoughtIndex = listing.s.indexOf(`${json.from}_`);
                if (whoBoughtIndex != -1) {
                  whoBoughtAmount = parseInt(
                    listing.s.split(`${json.from}_`)[1].split(",")[0]
                  );
                  allowed -= whoBoughtAmount;
                }
              }
              if (type == "HIVE" && amount >= listing.h && listing.h != 0) {
                qty = parseInt(amount / listing.h);
                refund_amount = amount % parseInt(listing.h);
                if (qty > allowed) {
                  tor = qty - allowed;
                  qty = allowed;
                  refund_amount += tor * listing.h;
                }
              } else if (type == "HBD" && amount >= listing.b && listing.b != 0) {
                qty = parseInt(amount / listing.b);
                refund_amount = amount % parseInt(listing.b);
                if (qty > allowed) {
                  tor = qty - allowed;
                  qty = allowed;
                  refund_amount += tor * listing.b;
                }
              }
              if (enf.max && whoBoughtIndex != -1) {
                listing.s.replace(
                  `${json.from}_${whoBoughtAmount}`,
                  `${json.from}_${whoBoughtAmount + qty}`
                );
              } else if (enf.max) {
                listing.s += `,${json.from}_${qty}`;
              }
              listing.q -= qty;
              if (enf.max) {
                if (!listing.p) listing.p = 0;
                listing.p += qty;
              }
              ops.push({ type: "put", path: ["lth", item], data: listing });
              if (listing.q <= 0) {
                qty += listing.q;
                refund_amount += listing.h * listing.q + listing.b * listing.q;
                if (!listing.p) ops.push({ type: "del", path: ["lth", item] });
              }
              if (qty && !enf.pb) {
                addMT(["rnfts", setname, json.from], parseInt(qty));
                transfers = [
                  ...buildSplitTransfers(
                    qty * listing.h + qty * listing.b,
                    type,
                    listing.d,
                    `${qty} ${setname}${qty > 1 ? "'s" : ""} purchased - ${json.from
                    }:${json.transaction_id.substr(0, 8)}:`
                  ),
                ];
              } else if (qty && enf.pb) {
                addMT(["pcon", "lth", listing.i, json.from], parseInt(qty));
                postVerify(enf.pb, json.from, listing.i, "lth");
                transfers = [];
              }
              if (refund_amount) {
                transfers.push([
                  "transfer",
                  {
                    to: json.from,
                    from: config.msaccount,
                    amount:
                      parseFloat(refund_amount / 1000).toFixed(3) + ` ${type}`,
                    memo: `Refund ${setname} mint token purchase:${json.transaction_id}:`,
                  },
                ]);
              }
              for (var i = 0; i < transfers.length; i++) {
                ops.push({
                  type: "put",
                  path: ["msa", `${i}:${json.transaction_id}:${json.block_num}`],
                  data: stringify(transfers[i]),
                });
              }
              const msg = `@${json.from}| bought ${qty} ${setname} token${qty > 1 ? "s" : ""
                } with ${parseFloat(parseInt(amount) / 1000).toFixed(3)} ${type}`;
              if (config.hookurl || config.status)
                postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: msg,
              });
              ops.push({ type: "put", path: ["stats"], data: stats });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            } else {
              ops.push({
                type: "put",
                path: ["msa", `${i}:${json.transaction_id}:${json.block_num}`],
                data: stringify([
                  "transfer",
                  {
                    to: json.from,
                    from: config.msaccount,
                    amount: json.amount,
                    memo: `Refund: Item(s) not found.`,
                  },
                ]),
              });
              const msg = `@${json.from}| can't locate item(s). Refund in progress.`;
              if (config.hookurl || config.status)
                postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}`],
                data: msg,
              });
              if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
              store.batch(ops, pc);
            }
          });
        } else if (
          json.memo.split(" ").length > 1 &&
          json.memo.split(" ")[0] == "NFTtrade"
        ) {
          let item = json.memo.split(" ")[1],
            setname = item.split(":")[0],
            uid = item.split(":")[1],
            Pstats = getPathObj(["stats"]),
            fnftp = getPathObj(["nfts", "t", item]),
            setp = getPathObj(["sets", setname]);
          Promise.all([fnftp, setp, Pstats])
            .then((nfts) => {
              var to,
                price,
                type,
                stats = nfts[2];
              try {
                to = nfts[0].t.split("_")[1];
                price = parseInt(nfts[0].t.split("_")[2]);
                type = nfts[0].t.split("_")[3];
                stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] +=
                  parseInt(json.amount.amount);
              } catch (e) {
                console.log(nfts[0]);
              }
              if (
                nfts[0].s !== undefined &&
                  to == json.from &&
                  parseInt(json.amount.amount) == price &&
                  (type == json.amount.nai) == "@@000000021"
                  ? "HIVE"
                  : "HBD"
              ) {
                let ops = [],
                  nft = nfts[0],
                  set = nfts[1];
                let royalties = parseInt((price * set.r) / 10000);
                let fee = parseInt((price * config.hive_service_fee) / 10000);
                let total = price - royalties - fee;
                const Transfer = [
                  "transfer",
                  {
                    from: config.msaccount,
                    to: nfts[0].t.split("_")[0],
                    amount: parseFloat(total / 1000).toFixed(3) + ` ${type}`,
                    memo: `${item} traded to ${json.from}.`,
                  },
                ];
                if (royalties) {
                  DEX.buyTokenFromDex(
                    royalties,
                    type,
                    json.block_num,
                    `roy_${json.transaction_id}`,
                    `n:${set.n}`,
                    json.timestamp,
                    config.TOKEN
                  ).then((empty) => {
                    DEX.buyTokenFromDex(
                      fee,
                      type,
                      json.block_num,
                      `fee_${json.transaction_id}`,
                      `rn`,
                      json.timestamp,
                      config.TOKEN
                    ).then((emp) => {
                      finish(set, json, listing, uid, item, Transfer, nft, pc);
                    });
                  });
                } else {
                  DEX.buyTokenFromDex(
                    fee,
                    type,
                    json.block_num,
                    `fee_${json.transaction_id}`,
                    `rn`,
                    json.timestamp,
                    config.TOKEN
                  ).then((emp) => {
                    finish(set, json, listing, uid, item, Transfer, nft, pc);
                  });
                }
                function finish(
                  set,
                  json,
                  listing,
                  uid,
                  item,
                  Transfer,
                  nft,
                  promise
                ) {
                  var ops = [];
                  nft.s = NFT.last(json.block_num, nft.s);
                  set.u = NFT.move(uid, json.from, set.u);
                  delete nft.t;
                  ops.push({
                    type: "put",
                    path: ["nfts", json.from, `${setname}:${uid}`],
                    data: nft,
                  });
                  ops.push({ type: "put", path: ["sets", setname], data: set });
                  ops.push({
                    type: "del",
                    path: ["nfts", "t", `${setname}:${uid}`],
                  });
                  ops.push({
                    type: "put",
                    path: ["msa", `${json.block_num}:vop_${json.transaction_id}`],
                    data: stringify(Transfer),
                  });
                  // is there anything in the NFT that needs to be modified? owner, renter,
                  let msg = `@${json.from} completed NFT: ${setname}:${uid} transfer`;
                  if (config.hookurl || config.status)
                    postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
                  ops.push({
                    type: "put",
                    path: ["feed", `${json.block_num}:${json.transaction_id}`],
                    data: msg,
                  });
                  ops.push({ type: "put", path: ["stats"], data: stats });
                  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                  store.batch(ops, promise);
                }
              } else {
                const transfer = [
                  "transfer",
                  {
                    to: json.from,
                    from: config.msaccount,
                    amount: json.amount,
                    memo: `Failed trade. ${json.transaction_id.substr(0, 8)}`,
                  },
                ];
                var ops = [];
                ops.push({
                  type: "put",
                  path: ["msa", `Failed:${setname}:${uid}:${json.transaction_id}`],
                  data: stringify(transfer),
                });
                let msg = `@${json.from} trade of ${setname}:${uid} didn't go well.`;
                if (config.hookurl || config.status)
                  postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
                ops.push({ type: "put", path: ["stats"], data: stats });
                if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                store.batch(ops, pc);
              }
            })
            .catch((e) => {
              console.log(e);
            });
        } else if (
          json.memo.split(" ").length > 1 &&
          json.memo.split(" ")[0] == "NFTbid"
        ) {
          let item = json.memo.split(" ")[1],
            set = item.split(":")[0],
            uid = item.split(":")[1];
          (ahp = getPathObj(["ahh", `${set}:${uid}`])),
            (Pstats = getPathObj(["stats"]));
          amount = parseInt(json.amount.amount);
          type = json.amount.nai == "@@000000021" ? "HIVE" : "HBD";
          Promise.all([ahp, Pstats])
            .then((mem) => {
              var stats = mem[1];
              stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] +=
                parseInt(json.amount.amount);
              if (mem[0].h == type) {
                // && json.from != mem[0].f){ //check for item and type
                var listing = mem[0];
                if (listing.b) {
                  if (amount > listing.b) {
                    const transfer = [
                      "transfer",
                      {
                        to: listing.f,
                        from: config.msaccount,
                        amount:
                          parseFloat(listing.b / 1000).toFixed(3) + ` ${type}`,
                        memo: `Outbid on ${set}:${uid}. ${json.transaction_id.substr(
                          0,
                          8
                        )}`,
                      },
                    ];
                    var ops = [];
                    ops.push({ type: "put", path: ["stats"], data: stats });
                    ops.push({
                      type: "put",
                      path: ["msa", `Outbid:${set}:${uid}:${json.transaction_id}`],
                      data: stringify(transfer),
                    });
                    listing.f = json.from;
                    listing.b = amount;
                    listing.c++;
                    ops.push({
                      type: "put",
                      path: ["ahh", `${set}:${uid}`],
                      data: listing,
                    });
                    let msg = `@${json.from} bid ${parseFloat(
                      amount / 1000
                    ).toFixed(3)} ${type} on ${set}:${uid}'s auction`;
                    if (config.hookurl || config.status)
                      postToDiscord(
                        msg,
                        `${json.block_num}:${json.transaction_id}`
                      );
                    ops.push({
                      type: "put",
                      path: ["feed", `${json.block_num}:${json.transaction_id}`],
                      data: msg,
                    });
                    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                    store.batch(ops, pc);
                  } else {
                    const transfer = [
                      "transfer",
                      {
                        to: json.from,
                        from: config.msaccount,
                        amount: json.amount,
                        memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(
                          0,
                          8
                        )}`,
                      },
                    ];
                    var ops = [];
                    ops.push({ type: "put", path: ["stats"], data: stats });
                    ops.push({
                      type: "put",
                      path: [
                        "msa",
                        `Underbid:${set}:${uid}:${json.transaction_id}`,
                      ],
                      data: stringify(transfer),
                    });
                    let msg = `@${json.from} hasn't outbid on ${set}:${uid}`;
                    if (config.hookurl || config.status)
                      postToDiscord(
                        msg,
                        `${json.block_num}:${json.transaction_id}`
                      );
                    if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                    store.batch(ops, pc);
                  }
                } else if (amount >= listing.p) {
                  listing.f = json.from;
                  listing.b = amount;
                  listing.c = 1;
                  var ops = [];
                  ops.push({ type: "put", path: ["stats"], data: stats });
                  ops.push({
                    type: "put",
                    path: ["ahh", `${set}:${uid}`],
                    data: listing,
                  });
                  let msg = `@${json.from} bid ${parseFloat(amount / 1000).toFixed(
                    3
                  )} ${type} on ${set}:${uid}'s auction`;
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
                  const transfer = [
                    "transfer",
                    {
                      to: json.from,
                      from: config.msaccount,
                      amount: json.amount,
                      memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(
                        0,
                        8
                      )}`,
                    },
                  ];
                  var ops = [];
                  ops.push({ type: "put", path: ["stats"], data: stats });
                  ops.push({
                    type: "put",
                    path: ["msa", `Underbid:${set}:${uid}:${json.transaction_id}`],
                    data: stringify(transfer),
                  });
                  let msg = `@${json.from} hasn't outbid on ${set}:${uid}`;
                  if (config.hookurl || config.status)
                    postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
                  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                  store.batch(ops, pc);
                }
              } else {
                const transfer = [
                  "transfer",
                  {
                    to: json.from,
                    from: config.msaccount,
                    amount: json.amount,
                    memo: `Underbid on ${set}:${uid}. ${json.transaction_id.substr(
                      0,
                      8
                    )}`,
                  },
                ];
                var ops = [];
                ops.push({ type: "put", path: ["stats"], data: stats });
                ops.push({
                  type: "put",
                  path: ["msa", `Underbid:${set}:${uid}:${json.transaction_id}`],
                  data: stringify(transfer),
                });
                let msg = `@${json.from} bid on ${set}:${uid} didn't go well.`;
                if (config.hookurl || config.status)
                  postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
                if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                store.batch(ops, pc);
              }
            })
            .catch((e) => {
              console.log(e);
            });
        } else if (
          json.memo.split(" ").length > 1 &&
          json.memo.split(" ")[0] == "NFTbuy"
        ) {
          let item = json.memo.split(" ")[1],
            setname = item.split(":")[0],
            uid = item.split(":")[1],
            lsp = getPathObj(["ls", `${setname}:${uid}`]),
            setp = getPathObj(["sets", setname]),
            Pstats = getPathObj(["stats"]);
          amount = parseInt(json.amount.amount);
          type = json.amount.nai == "@@000000021" ? "HIVE" : "HBD";
          Promise.all([lsp, setp, Pstats])
            .then((mem) => {
              var stats = mem[2];
              stats.MSHeld[type] += amount;
              if (mem[0].h == type && json.from != mem[0].o && amount == mem[0].p) {
                //check for item and type
                let listing = mem[0],
                  set = mem[1],
                  ops = [],
                  promises = [],
                  // const fee = parseInt(listing.b /100); add('n', fee); listingb = listing.b - fee;
                  nft = listing.nft;
                const last_modified = nft.s.split(",")[0];
                nft.s.replace(last_modified, Base64.fromNumber(json.block_num)); //update last modified
                let royalties = parseInt((listing.p * set.r) / 10000);
                let fee = parseInt((listing.p * config.hive_service_fee) / 10000);
                let total = listing.p - royalties - fee;
                const Transfer = [
                  "transfer",
                  {
                    from: config.msaccount,
                    to: listing.o,
                    amount: parseFloat(total / 1000).toFixed(3) + ` ${listing.h}`,
                    memo: `${item} sold to ${json.from}.`,
                  },
                ];
                if (royalties) {
                  DEX.buyTokenFromDex(
                    royalties,
                    listing.h,
                    json.block_num,
                    `roy_${json.transaction_id}`,
                    `n:${set.n}`,
                    json.timestamp,
                    config.TOKEN
                  ).then((empty) => {
                    DEX.buyTokenFromDex(
                      fee,
                      listing.h,
                      json.block_num,
                      `fee_${json.transaction_id}`,
                      `rn`,
                      json.timestamp,
                      config.TOKEN
                    ).then((emp) => {
                      finish(set, json, listing, uid, item, Transfer, nft, pc);
                    });
                  });
                } else {
                  DEX.buyTokenFromDex(
                    fee,
                    listing.h,
                    json.block_num,
                    `fee_${json.transaction_id}`,
                    `rn`,
                    json.timestamp,
                    config.TOKEN
                  ).then((emp) => {
                    finish(set, json, listing, uid, item, Transfer, nft, pc);
                  });
                }
                function finish(
                  set,
                  json,
                  listing,
                  uid,
                  item,
                  Transfer,
                  nft,
                  promise
                ) {
                  var ops = [];
                  ops.push({ type: "put", path: ["stats"], data: stats });
                  if (set != "Qm")
                    set.u = NFT.move(uid, json.from, set.u); //update set
                  else set.u = json.from;
                  ops.push({
                    type: "put",
                    path: ["nfts", json.from, item],
                    data: nft,
                  }); //update nft
                  const msg = `Sell of ${listing.o}'s ${item} finalized for ${Transfer[1].amount} to ${json.from}`;
                  ops.push({
                    type: "put",
                    path: ["feed", `${json.block_num}:vop_${json.transaction_id}`],
                    data: msg,
                  });
                  ops.push({
                    type: "put",
                    path: ["msa", `${json.block_num}:vop_${json.transaction_id}`],
                    data: stringify(Transfer),
                  });
                  if (config.hookurl)
                    postToDiscord(
                      msg,
                      `${json.block_num}:vop_${json.transaction_id}`
                    );
                  if (set != "Qm")
                    ops.push({
                      type: "put",
                      path: ["sets", set.n],
                      data: set,
                    });
                  //update set
                  else
                    ops.push({
                      type: "put",
                      path: ["sets", `Qm${uid}`],
                      data: set,
                    });
                  ops.push({ type: "del", path: ["ls", item] });
                  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                  store.batch(ops, promise);
                }
              } else {
                const transfer = [
                  "transfer",
                  {
                    to: json.from,
                    from: config.msaccount,
                    amount: parseFloat(listing.b / 1000).toFixed(3) + ` ${type}`,
                    memo: `Failed to buy ${setname}:${uid}. ${json.transaction_id.substr(
                      0,
                      8
                    )}`,
                  },
                ];
                var ops = [];
                ops.push({ type: "put", path: ["stats"], data: stats });
                ops.push({
                  type: "put",
                  path: ["msa", `FailedBuy:${set}:${uid}:${json.transaction_id}`],
                  data: stringify(transfer),
                });
                let msg = `@${json.from} buy of ${set}:${uid} didn't go well.`;
                if (config.hookurl || config.status)
                  postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
                if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                store.batch(ops, pc);
              }
            })
            .catch((e) => {
              console.log(e);
            });
        } else {
          //console.log(json)
          let order = {
            type: "LIMIT",
            token: "SPK"
          },
            path = "",
            waiting = Promise.resolve(""),
            contract = "";
          try {
            order = JSON.parse(json.memo);
          } catch (e) { }
          if (!order.rate) {
            order.type = "MARKET";
            order.rate = 0;
          } else {
            order.type = "LIMIT";
            order.rate = parseFloat(order.rate).toFixed(6);
          }
          if (parseFloat(order.rate) < 0) {
            order.type = "MARKET";
            order.rate = 0;
          }
          order.pair = json.amount.nai == "@@000000021" ? "hive" : "hbd";
          order.amount = parseInt(json.amount.amount);
          //console.log({order})
          if (order.type == "MARKET" || order.type == "LIMIT") {
            if (order.token != 'SPK') order.token = 'LARYNX'
            let pDEX = getPathObj([`dex${order.token == 'SPK' ? 's' : (order.token == 'BROCA' ? 'b' : '')}}`, order.pair]),
              pBal = getPathNum([order.token == 'SPK' ? 'spk' : 'balances', json.from]),
              pInv = getPathNum(["balances", "ri"]),
              pStats = getPathObj(["stats"]);
            Promise.all([pDEX, pBal, pInv, pStats]).then((mem) => {
              let dex = mem[0],
                bal = mem[1],
                inv = mem[2],
                stats = mem[3],
                filled = 0,
                remaining = order.amount,
                ops = [],
                his = {},
                fee = 0,
                i = 0;
              if (typeof order.rate != "string") order.rate = dex.tick;
              if (order.token == 'SPK') stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * dex.tick)
              stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] +=
                parseInt(json.amount.amount);
              while (remaining) {
                i++;
                var price = dex.sellBook
                  ? parseFloat(dex.sellBook.split("_")[0]).toFixed(6)
                  : "";
                let item = "";
                if (price) item = dex.sellBook.split("_")[1].split(",")[0];
                else price = dex.tick;
                if (order.token == 'SPK') stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * dex.tick)
                //console.log("Matching...", { order, price, item });
                if (
                  item &&
                  (order.pair == "hbd" ||
                    (order.pair == "hive" &&
                      (order.token == 'SPK' || order.token == 'BROCA' || price <= stats.icoPrice / 1000 || !config.features.ico))) &&
                  (order.type == "MARKET" ||
                    (order.type == "LIMIT" && order.rate >= price))
                ) {
                  var next = dex.sellOrders?.[`${price}:${item}`];
                  //console.log("Matched order", { next });
                  if (next && next[order.pair] <= remaining) {
                    if (next[order.pair]) {
                      //console.log("Partial Fill");
                      if (order.token == 'BROCA' && stats.broca_clawback) {
                        newClawback = parseInt((remaining / next.amount) * stats.broca_clawback / 10000)
                        clawback += newClawback
                        next.amount = Math.max(0, next.amount - newClawback);
                      }
                      filled += next.amount - next.fee;
                      bal += next.amount - next.fee; //update the balance
                      fee += next.fee; //add the fees
                      remaining -= next[order.pair];
                      dex.tick = next.rate;
                      if (order.token == 'SPK') stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * dex.tick)
                      his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                        type: "buy",
                        t: Date.parse(json.timestamp),
                        block: json.block_num,
                        base_vol: next.amount,
                        target_vol: next[order.pair],
                        target: order.pair,
                        price: next.rate,
                        id: json.transaction_id + i,
                      };
                      dex.sellBook = DEX.remove(item, dex.sellBook); //adjust the orderbook
                      delete dex.sellOrders[`${price}:${item}`];
                      const transfer = [
                        "transfer",
                        {
                          from: config.msaccount,
                          to: next.from,
                          amount:
                            parseFloat(next[order.pair] / 1000).toFixed(3) +
                            " " +
                            order.pair.toUpperCase(),
                          memo: `Filled ${item}:${json.transaction_id}`,
                        },
                      ];
                      let msg = `@${json.from} bought ${parseFloat(
                        parseInt(next.amount) / 1000
                      ).toFixed(3)} ${config.TOKEN} with ${parseFloat(
                        parseInt(next[order.pair]) / 1000
                      ).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from
                        } (${item})`;
                      ops.push({
                        type: "put",
                        path: [
                          "feed",
                          `${json.block_num}:${json.transaction_id}.${i}`,
                        ],
                        data: msg,
                      });
                      if (Object.keys(his).length)
                        ops.push({
                          type: "put",
                          path: [order.token == 'SPK' ? 'dexs' : (order.token == 'BROCA' ? 'dexb' : 'dex'), order.pair, "his"],
                          data: his,
                        });
                      ops.push({
                        type: "put",
                        path: ["msa", `${item}:${json.transaction_id}:${i}`],
                        data: stringify(transfer),
                      }); //send HIVE out via MS
                      ops.push({
                        type: "del",
                        path: [order.token == 'SPK' ? 'dexs' : (order.token == 'BROCA' ? 'dexb' : 'dex'), order.pair, "sellOrders", `${price}:${item}`],
                      }); //remove the order
                      ops.push({
                        type: "del",
                        path: ["contracts", next.from, item],
                      }); //remove the contract
                      ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
                    } else {
                      //console.log("Only fees left...");
                      fee += next.fee;
                      fee += next.amount;
                      dex.sellBook = DEX.remove(item, dex.sellBook); //adjust the orderbook
                      delete dex.sellOrders[`${price}:${item}`];
                      ops.push({
                        type: "del",
                        path: [order.token == 'SPK' ? 'dexs' : (order.token == 'BROCA' ? 'dexb' : 'dex'), order.pair, "sellOrders", `${price}:${item}`],
                      }); //remove the order
                      ops.push({
                        type: "del",
                        path: ["contracts", next.from, item],
                      }); //remove the contract
                      ops.push({ type: "del", path: ["chrono", next.expire_path] }); //remove the chrono
                    }
                  } else if (!next && dex.sellBook.indexOf(item) > -1) {
                    //console.log("Sell Book Error:", dex.sellBook);
                    dex.sellBook = DEX.remove(item, dex.sellBook);
                  } else {
                    //console.log("Filled");
                    if (order.token == 'BROCA' && stats.broca_clawback) {
                      newClawback = parseInt((remaining / next.amount) * stats.broca_clawback / 10000)
                      clawback += newClawback
                      next.amount -= newClawback
                    }
                    next[order.pair] = next[order.pair] - remaining; // modify the contract
                    const tokenAmount = parseInt(remaining / parseFloat(next.rate));
                    const feeAmount = parseInt(
                      (tokenAmount / next.amount) * next.fee
                    );
                    filled += tokenAmount - feeAmount;
                    bal += tokenAmount - feeAmount; //update the balance
                    fee += feeAmount; //add the fees
                    next.amount -= tokenAmount;
                    next.fee -= feeAmount;
                    his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                      type: "buy",
                      t: Date.parse(json.timestamp),
                      block: json.block_num,
                      base_vol: tokenAmount,
                      target_vol: remaining,
                      target: order.pair,
                      price: next.rate,
                      id: json.transaction_id + i,
                    };
                    if (!next.partial) {
                      next.partial = {
                        [json.transaction_id]: {
                          token: tokenAmount,
                          coin: remaining,
                        },
                      };
                    } else {
                      next.partial[json.transaction_id] = {
                        token: tokenAmount,
                        coin: remaining,
                      };
                    }
                    dex.tick = next.rate;
                    if (order.token == 'SPK') stats.multiSigCollateralValue = parseInt(stats.multiSigCollateral * dex.tick)
                    dex.sellOrders[`${price}:${item}`] = next;
                    const transfer = [
                      "transfer",
                      {
                        from: config.msaccount,
                        to: next.from,
                        amount:
                          parseFloat(remaining / 1000).toFixed(3) +
                          " " +
                          order.pair.toUpperCase(),
                        memo: `Partial Filled ${item}:${json.transaction_id}`,
                      },
                    ];
                    let msg = `@${json.from} bought ${parseFloat(
                      parseInt(tokenAmount) / 1000
                    ).toFixed(3)} ${config.TOKEN} with ${parseFloat(
                      parseInt(remaining) / 1000
                    ).toFixed(3)} ${order.pair.toUpperCase()} from ${next.from
                      } (${item})`;
                    remaining = 0;
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
                      path: [order.token == 'SPK' ? 'spk' : 'balances', json.from],
                      data: bal,
                    });
                    ops.push({
                      type: "put",
                      path: [order.token == 'SPK' ? 'dexs' : (order.token == 'BROCA' ? 'dexb' : 'dex'), order.pair, "his"],
                      data: his,
                    });
                    ops.push({
                      type: "put",
                      path: ["msa", `${item}:${json.transaction_id}:${i}`],
                      data: stringify(transfer),
                    }); //send HIVE out via MS
                    //ops.push({type: 'put', path: ['dex', order.pair, 'sellOrders', `${price.toFixed(6)}:${item}`], data: next}) //update the order
                    ops.push({
                      type: "put",
                      path: ["contracts", next.from, item],
                      data: next,
                    }); //update the contract
                  }
                } else {
                  if (
                    config.features.ico &&
                    (order.token != 'SPK' || order.token != 'BROCA') &&
                    order.pair == "hive" &&
                    (order.type == "MARKET" ||
                      order.type == "AUCTION")
                  ) {
                    //console.log("Auction");
                    let purchase = 0
                    // const transfer = [
                    //   "transfer",
                    //   {
                    //     from: config.msaccount,
                    //     to: config.mainICO,
                    //     amount:
                    //       parseFloat(remaining / 1000).toFixed(3) +
                    //       " " +
                    //       order.pair.toUpperCase(),
                    //     memo: `ICO Buy from ${json.from}:${json.transaction_id}`,
                    //   },
                    // ];
                    // ops.push({
                    //   type: "put",
                    //   path: [
                    //     "msa",
                    //     `ICO@${json.from}:${json.transaction_id}:${json.block_num}`,
                    //   ],
                    //   data: stringify(transfer),
                    // }); //send HIVE out via MS
                    //dex.tick = parseFloat(stats.icoPrice / 1000).toFixed(6);
                    if (false) { //stats.outonblock
                      // purchase = parseInt((remaining / stats.icoPrice) * 1000);
                      // filled += purchase;
                      // if (purchase < inv) {
                      //   inv -= purchase;
                      //   bal += purchase;
                      //   his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                      //     type: "buy",
                      //     t: Date.parse(json.timestamp),
                      //     block: json.block_num,
                      //     base_vol: purchase,
                      //     target_vol: remaining,
                      //     target: order.pair,
                      //     price: parseFloat(stats.icoPrice / 1000).toFixed(6),
                      //     id: json.transaction_id + i,
                      //   };
                      //   const msg = `@${json.from}| bought ${parseFloat(
                      //     purchase / 1000
                      //   ).toFixed(3)} ${order.token == 'SPK' ? 'SPK' : (order.token == 'BROCA' ? 'BROCA' : 'LARYNX')} with ${parseFloat(
                      //     remaining / 1000
                      //   ).toFixed(3)} HIVE`;
                      //   ops.push(
                      //     {
                      //       type: "put",
                      //       path: [
                      //         "feed",
                      //         `${json.block_num}:${json.transaction_id}:${i}`,
                      //       ],
                      //       data: msg,
                      //     },
                      //     { type: "put", path: [order.token == 'SPK' ? 'spk' : 'balances', "ri"], data: inv }
                      //   );
                      // } else {
                      //   bal += inv;
                      //   const left = purchase - inv;
                      //   stats.outOnBlock = json.block_num;
                      //   his[`${json.block_num}:${i}:${json.transaction_id}`] = {
                      //     type: "buy",
                      //     t: Date.parse(json.timestamp),
                      //     block: json.block_num,
                      //     base_vol: inv,
                      //     target_vol: remaining,
                      //     target: order.pair,
                      //     price: parseFloat(stats.icoPrice / 1000).toFixed(6),
                      //     id: json.transaction_id + i,
                      //   };
                      //   const msg = `@${json.from}| bought ALL ${parseFloat(
                      //     parseInt(purchase - left)
                      //   ).toFixed(3)} ${order.token == 'SPK' ? 'SPK' : (order.token == 'BROCA' ? 'BROCA' : 'LARYNX')} with ${parseFloat(
                      //     parseInt(order.amount) / 1000
                      //   ).toFixed(3)} HIVE. And bid in the over-auction`;
                      //   ops.push(
                      //     {
                      //       type: "put",
                      //       path: ["ico", `${json.block_num}`, json.from],
                      //       data: parseInt((order.amount * left) / purchase),
                      //     },
                      //     { type: "put", path: [order.token == 'SPK' ? 'spk' : 'balances', "ri"], data: 0 },
                      //     {
                      //       type: "put",
                      //       path: [
                      //         "feed",
                      //         `${json.block_num}:${json.transaction_id}`,
                      //       ],
                      //       data: msg,
                      //     }
                      //   );
                      // }
                      // remaining = 0;
                    } else {
                      const msg = `@${json.from}|  Entered LARYNX Auction with ${parseFloat(
                        parseInt(amount) / 1000
                      ).toFixed(3)} HIVE.`;
                      if (config.hookurl || config.status)
                        postToDiscord(
                          msg,
                          `${json.block_num}:${json.transaction_id}`
                        );
                      ops = [
                        {
                          type: "put",
                          path: ["auction", `${json.block_num}`, json.from],
                          data: parseInt(amount),
                        },
                        {
                          type: "put",
                          path: [
                            "feed",
                            `${json.block_num}:${json.transaction_id}`,
                          ],
                          data: msg,
                        },
                      ];
                      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                      ops.push({ type: "put", path: ["stats"], data: stats });
                      if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                      store.batch(ops, pc);
                    }
                  } else {
                    //console.log("Building contract");
                    const txid =
                      config.TOKEN + hashThis(json.from + json.transaction_id),
                      crate = parseFloat(order.rate) > 0 ? order.rate : dex.tick,
                      toRefund = maxAllowed(stats, dex.tick, remaining, crate);
                    remaining = remaining - toRefund;
                    //console.log({ toRefund, remaining });
                    const hours = 720,
                      expBlock = json.block_num + hours * 1200;
                    if (toRefund) {
                      const transfer = [
                        "transfer",
                        {
                          from: config.msaccount,
                          to: json.from,
                          amount:
                            parseFloat(toRefund / 1000).toFixed(3) +
                            " " +
                            order.pair.toUpperCase(),
                          memo: `Partial refund due to collateral limits ${json.from}:${json.transaction_id}`,
                        },
                      ];
                      ops.push({
                        type: "put",
                        path: [
                          "msa",
                          `Refund@${json.from}:${json.transaction_id}:${json.block_num}`,
                        ],
                        data: stringify(transfer),
                      });
                    }
                    contract = {
                      txid,
                      from: json.from,
                      hive: 0,
                      hbd: 0,
                      fee: 0,
                      amount: 0,
                      rate: crate,
                      block: json.block_num,
                      type: `${order.pair}:buy`,
                      hive_id: json.transaction_id,
                    };
                    contract.amount = parseInt(remaining / crate);
                    contract.fee = parseFloat(stats.dex_fee) > 0
                      ? parseInt(
                        parseInt(contract.amount) * parseFloat(stats.dex_fee)
                      ) + 1
                      : parseInt(contract.amount * 0.005) + 1,
                      contract[order.pair] = remaining;
                    if (remaining) {
                      var expOp = "expire"
                      if (order.token == 'SPK') expOp = "expires"
                      else if (order.token == 'BROCA') expOp = "expireb"
                      dex.buyBook = DEX.insert(txid, crate, dex.buyBook, "buy");
                      path = chronAssign(expBlock, {
                        block: expBlock,
                        op: expOp,
                        from: json.from,
                        txid,
                      });
                      remaining = 0;
                    }
                    //console.log({ contract });
                  }
                }
              }
              let msg = "";
              if (remaining == order.amount) {
                msg = `@${json.from} set a buy order at ${contrate.rate}.`;
              } else if (json.from != "rn") {
                msg = `@${json.from} | order received.`;
                waiting = order.token == 'SPK' ? addSpk("u", fee) : (order.token == 'BROCA' ? addBroca("u", fee) : add("rn", fee))
              } else {
                //console.log({ fee });
                msg = `@${json.from} | order received.`;
                bal += fee;
              }
              if (config.hookurl || config.status)
                postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
              ops.push({ type: "put", path: [order.token == 'SPK' ? "spk" : (order.token == 'BROCA' ? "Broca" : "balances"), json.from], data: bal });
              ops.push({
                type: "put",
                path: ["feed", `${json.block_num}:${json.transaction_id}.${i++}`],
                data: msg,
              });
              if (Object.keys(his).length)
                ops.push({
                  type: "put",
                  path: [`dex${order.token == 'SPK' ? 's' : (order.token == 'BROCA' ? 'b' : '')}`, order.pair, "his"],
                  data: his,
                });
              if (!path) {
                Promise.all([waiting, burnBroca(clawback)]).then((empty) => {
                  ops.push({ type: "put", path: [`dex${order.token == 'SPK' ? 's' : (order.token == 'BROCA' ? 'b' : '')}`, order.pair], data: dex });
                  ops.push({ type: "put", path: ["stats"], data: stats });
                  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                  store.batch(ops, pc);
                });
              } else {
                Promise.all([path, waiting]).then((expPath) => {
                  contract.expire_path = expPath[0];
                  ops.push({
                    type: "put",
                    path: ["contracts", json.from, contract.txid],
                    data: contract,
                  });
                  if (dex.buyOrders) {
                    dex.buyOrders[`${contract.rate}:${contract.txid}`] = contract;
                  } else {
                    dex.buyOrders = {
                      [`${contract.rate}:${contract.txid}`]: contract,
                    };
                  }
                  let msg = `@${json.from} is buying ${parseFloat(
                    parseInt(contract.amount) / 1000
                  ).toFixed(3)} ${order.token == 'SPK' ? 'SPK' : (order.token == 'BROCA' ? 'BROCA' : 'LARYNX')} for ${parseFloat(
                    parseInt(contract[order.pair]) / 1000
                  ).toFixed(3)} ${order.pair.toUpperCase()}(${contract.rate}:${contract.txid
                    })`;
                  ops.push({ type: "put", path: [order.token == 'SPK' ? 'dexs' : (order.token == 'BROCA' ? 'dexb' : 'dex'), order.pair], data: dex });
                  ops.push({
                    type: "put",
                    path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
                    data: msg,
                  });
                  ops.push({ type: "put", path: ["stats"], data: stats });
                  if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                  store.batch(ops, pc);
                });
              }
            });
          } else {
            const transfer = [
              "transfer",
              {
                from: config.msaccount,
                to: json.from,
                amount: json.amount,
                memo: `This doesn't appear to be formatted correctly to buy ${config.TOKEN}`,
              },
            ];
            let msg = `@${json.from} sent a weird transaction to ${config.msaccount}: refunding`;
            ops.push({
              type: "put",
              path: ["feed", `${json.block_num}:${json.transaction_id}.${i}`],
              data: msg,
            });
            ops.push({
              type: "put",
              path: [
                "msa",
                `refund@${json.from}:${json.transaction_id}:${json.block_num}`,
              ],
              data: stringify(transfer),
            });
            ops.push({ type: "put", path: ["stats"], data: stats });
            if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
            store.batch(ops, pc);
          }
        }
      } else if (config.features.dex && json.from == config.msaccount) {
        var Pmss = getPathObj(["mss"]),
          Pstats = getPathObj(["stats"]);

        Promise.all([Pmss, Pstats]).then((mem) => {
          var mss = mem[0],
            stats = mem[1];
          stats.MSHeld[json.amount.nai == "@@000000021" ? "HIVE" : "HBD"] -=
            parseInt(json.amount.amount);
          var ops = [{ type: "put", path: ["stats"], data: stats }];
          for (var block in mss) {
            if (block.split(":").length < 2 && mss[block].indexOf(json.memo) > 0) {
              ops.push({ type: "del", path: ["mss", `${block}`] });
              ops.push({ type: "del", path: ["mss", `${block}:sigs`] });
              break;
            }
          }
          if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
          store.batch(ops, pc);
        });
      } else {
        store.get(
          ["escrow", json.from, json.memo.split(" ")[0] + ":transfer"],
          function (e, a) {
            var ops = [];
            if (!e && !isEmpty(a)) {
              let auth = true,
                terms = Object.keys(a[1]);
              for (i = 0; i < terms.length; i++) {
                if (json[terms[i]] !== a[1][terms[i]]) {
                  auth = false;
                }
              }
              //console.log("authed " + auth);
              if (auth) {
                const msg = `@${json.from}| sent @${json.to} ${nai(
                  json.amount
                )} for ${json.memo.split(" ")[0]}`;
                if (config.hookurl || config.status)
                  postToDiscord(msg, `${json.block_num}:${json.transaction_id}`);
                ops.push({
                  type: "put",
                  path: ["feed", `${json.block_num}:${json.transaction_id}`],
                  data: msg,
                });
                let addr = json.memo.split(" ")[0],
                  co = json.memo.split(" ")[2],
                  cp = getPathObj(["contracts", co, addr]),
                  sp = getPathObj(["contracts", json.to, addr]),
                  gp = getPathNum(["gov", json.from]);
                Promise.all([cp, gp, sp])
                  .then((ret) => {
                    let d = ret[1],
                      c = ret[0];
                    if (!c.escrow_id) {
                      c = ret[2];
                      co = c.co;
                    }
                    (eo = c.buyer), (g = c.escrow);
                    if (c.type === "sb" || c.type === "db") eo = c.from;
                    //console.log(c);
                    let lil_ops = [
                      addGov(json.from, parseInt(c.escrow)),
                      addCol(json.from, -parseInt(c.escrow)),
                      add(json.from, parseInt(c.fee / 3)),
                      deletePointer(c.escrow_id, eo),
                      credit(json.from),
                    ];
                    //console.log(json.from, parseInt(c.fee / 3));
                    ops.push({
                      type: "del",
                      path: ["escrow", json.from, addr + ":transfer"],
                    });
                    ops.push({ type: "del", path: ["contracts", co, addr] });
                    ops.push({ type: "del", path: ["chrono", c.expire_path] });
                    if (json.from == config.username) {
                      //delete plasma.pending[i + ':transfer']
                      let NodeOps = GetNodeOps();
                      for (var i = 0; i < NodeOps.length; i++) {
                        if (
                          NodeOps[i][1][1].from == json.from &&
                          NodeOps[i][1][1].to == json.to &&
                          NodeOps[i][1][0] == "transfer" &&
                          NodeOps[i][1][1].hive_amount == json.hive_amount &&
                          NodeOps[i][1][1].hbd_amount == json.hbd_amount
                        ) {
                          spliceOp(i);
                        }
                      }
                    }
                    Promise.all(lil_ops)
                      .then((empty) => {
                        if (process.env.npm_lifecycle_event == "test") pc[2] = ops;
                        store.batch(ops, pc);
                      })
                      .catch((e) => {
                        reject(e);
                      });
                  })
                  .catch((e) => {
                    console.log(e);
                  });
              } else {
                pc[0](pc[2]);
              }
            } else {
              pc[0](pc[2]);
            }
          }
        );
      }
    }
  }
]
const CustomAPI = [
  {
    path: '/list-contracts',
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      var contracts = {};
      res.setHeader("Content-Type", "application/json");
      store.get(["contract"], function (err, obj) {
        (contracts = obj),
          res.send(
            JSON.stringify(
              {
                contracts,
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
      });
    }
  },
  {
    path: "/user_services/:un",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      let user = req.params.un;
      let services = getPathObj(["services", user]);
      Promise.all([services]).then((mem) => {
        res.send(
          JSON.stringify(
            {
              services: mem[0],
              node: config.username,
              head_block: RAM.head,
              behind: RAM.behind,
              VERSION,
            },
            null,
            3
          )
        );
      });
    }
  },
  {
    path: "/services/:type",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      let type = req.params.type;
      let services = getPathObj(["service", type]);
      Promise.all([services]).then((mem) => {
        let s = Object.keys(mem[0]),
          t = [];
        for (var i = 0; i < s.length; i++) {
          t.push(getPathObj(["services", s[i], type]));
        }
        Promise.all(t).then((all) => {
          res.send(
            JSON.stringify(
              {
                providers: mem[0],
                services: all,
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        });
      });
    }
  },
  {
    path: "/@:un",
    func: function (req, res, next, context) {
      const { getPathNum, getPathObj, config, RAM, VERSION } = context;
      let un = req.params.un,
        bal = getPathNum(['balances', un]),
        cbal = getPathNum(['cbalances', un]),
        claims = getPathObj(['snap', un]),
        pb = getPathNum(['pow', un]),
        lp = getPathObj(['granted', un]),
        lg = getPathObj(['granting', un]),
        contracts = getPathObj(['contracts', un]),
        incol = getPathNum(['col', un]), //collateral
        gp = getPathNum(['gov', un]),
        pup = getPathObj(['up', un]),
        pdown = getPathObj(['down', un]),
        pspk = getPathNum(['spk', un]),
        pspkb = getPathNum(['spkb', un]),
        tick = getPathNum(['dex', 'hive', 'tick']),
        ticks = getPathNum(['dexs', 'hive', 'tick']),
        tickb = getPathNum(['dexb', 'hive', 'tick']),
        powdown = getPathObj(['powd', un]),
        govdown = getPathObj(['govd', un]),
        pspowdown = getPathObj(['spowd', un]),
        pbpowdown = getPathObj(['bpowd', un]),
        chron = getPathObj(['chrono']),
        ppubKey = getPathObj(['authorities', un]),
        pspow = getPathNum(['spow', un]),
        pbroca = getPathObj(["broca", un]),
        pChannels = getPathObj(["proffer", un]),
        pContract = getPathObj(["contract", un]),
        pspkVote = getPathObj(["spkVote", un]),
        pNode = getPathObj(["markets", "node", un]),
        pStorage = getPathObj(["service", "IPFS", un]),
        pcspk = getPathNum(['cspk', un]),
        pbpow = getPathNum(['bpow', un]),
        plbroca = getPathNum(["lbroca", un])
      res.setHeader('Content-Type', 'application/json');
      Promise.all([bal, pb, lp, contracts, incol, gp, pup, pdown, lg, cbal, claims, pspk, pspkb, tick, powdown, govdown, chron, ppubKey, pspow, pbroca, pChannels, pspkVote, pContract, pStorage, pNode, pcspk, pspowdown, pbpowdown, pbpow, plbroca, ticks, tickb])
        .then(function (v) {
          var arr = []
          for (var i in v[3]) {
            var c = v[3][i]
            if (c.partial) {
              c.partials = []
              for (var p in c.partial) {
                var j = c.partial[p]
                j.txid = p
                c.partials.push(j)
              }
            }
            arr.push(c)
          }
          const pubKey = typeof v[17] == 'string' ? v[17] : 'NA'
          var power_downs = v[14]
          if (power_downs) {
            for (var pd in power_downs) {
              power_downs[pd] = v[16][pd]
            }
          }
          var spower_downs = v[26]
          if (spower_downs) {
            for (var pd in power_downs) {
              spower_downs[pd] = v[16][pd]
            }
          }
          var bpower_downs = v[27]
          if (bpower_downs) {
            for (var pd in power_downs) {
              bpower_downs[pd] = v[16][pd]
            }
          }
          var granted = v[2]
          var granting = v[8]
          if (!granted.t) granted.t = 0
          if (!granting.t) granting.t = 0
          res.send(
            JSON.stringify(
              {
                name: un,
                balance: v[0],
                claim: v[9],
                claim_spk: v[25],
                drop: {
                  availible: {
                    amount: 0,
                    precision: 3,
                    token: "LARYNX",
                  },
                  last_claim: v[10].l || 0,
                  total_claims: v[10].t || 0,
                }, //v[10],
                poweredUp: v[1],
                granted,
                granting,
                heldCollateral: v[4],
                contracts: arr,
                channels: v[20],
                file_contracts: v[22],
                storage: v[23],
                spknode: v[24],
                pubKey,
                up: v[6],
                down: v[7],
                power_downs,
                spower_downs,
                bpower_downs,
                gov_downs: v[15],
                gov: v[5],
                spk: v[11],
                spk_block: v[12],
                spk_power: v[18],
                spk_vote: v[21],
                broca: typeof v[19] == 'string' ? v[19] : '0,0',
                liq_broca: v[29],
                pow_broca: v[28],
                tick: v[13],
                tick_spk: v[30],
                tick_broca: v[31],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        })
        .catch(function (err) {
          console.log(err)
        })
    }
  },
  {
    path: "/spk/@:un",
    func: function (req, res, next, context) {
      const { getPathNum, getPathObj, config, RAM, VERSION } = context;
      let un = req.params.un,
        bal = getPathNum(['balances', un]),
        cbal = getPathNum(['cspk', un]),
        claims = getPathObj(['snap', un]),
        pb = getPathNum(['pow', un]),
        lp = getPathObj(['granted', un]),
        lg = getPathObj(['granting', un]),
        contracts = getPathObj(['contracts', un]),
        incol = getPathNum(['col', un]), //collateral
        gp = getPathNum(['gov', un]),
        pup = getPathObj(['up', un]),
        pdown = getPathObj(['down', un]),
        pspk = getPathNum(['spk', un]),
        pspkb = getPathNum(['spkb', un]),
        tick = getPathObj(['dexs', 'hive', 'tick']),
        powdown = getPathObj(['powd', un]),
        govdown = getPathObj(['govd', un]),
        pspowdown = getPathObj(['spowd', un]),
        pbpowdown = getPathObj(['bpowd', un]),
        chron = getPathObj(['chrono']),
        ppubKey = getPathObj(['authorities', un]),
        pspow = getPathNum(['spow', un]),
        pbroca = getPathObj(["broca", un]),
        pChannels = getPathObj(["proffer", un]),
        pContract = getPathObj(["contract", un]),
        pspkVote = getPathObj(["spkVote", un]),
        pNode = getPathObj(["markets", "node", un]),
        pStorage = getPathObj(["service", "IPFS", un]),
        pcspk = getPathNum(['cspk', un]),
        pbpow = getPathNum(['bpow', un]),
        plbroca = getPathNum(["lbroca", un])
      res.setHeader('Content-Type', 'application/json');
      Promise.all([bal, pb, lp, contracts, incol, gp, pup, pdown, lg, cbal, claims, pspk, pspkb, tick, powdown, govdown, chron, ppubKey, pspow, pbroca, pChannels, pspkVote, pContract, pStorage, pNode, pcspk, pspowdown, pbpowdown, pbpow, plbroca])
        .then(function (v) {
          var arr = []
          for (var i in v[3]) {
            var c = v[3][i]
            if (c.partial) {
              c.partials = []
              for (var p in c.partial) {
                var j = c.partial[p]
                j.txid = p
                c.partials.push(j)
              }
            }
            arr.push(c)
          }
          const pubKey = typeof v[17] == 'string' ? v[17] : 'NA'
          var power_downs = v[14]
          if (power_downs) {
            for (var pd in power_downs) {
              power_downs[pd] = v[16][pd]
            }
          }
          var spower_downs = v[26]
          if (spower_downs) {
            for (var pd in power_downs) {
              spower_downs[pd] = v[16][pd]
            }
          }
          var bpower_downs = v[27]
          if (bpower_downs) {
            for (var pd in power_downs) {
              bpower_downs[pd] = v[16][pd]
            }
          }
          var granted = v[2]
          var granting = v[8]
          if (!granted.t) granted.t = 0
          if (!granting.t) granting.t = 0
          res.send(
            JSON.stringify(
              {
                name: un,
                balance: v[11],
                claim_larynx: v[9],
                claim: v[25],
                poweredUp: v[18],
                larynx_power: v[1],
                heldCollateral: v[4],
                contracts: arr,
                channels: v[20],
                file_contracts: v[22],
                storage: v[23],
                spknode: v[24],
                pubKey,
                up: v[6],
                down: v[7],
                power_downs: spower_downs,
                lpower_downs: power_downs,
                bpower_downs,
                spk: v[11],
                spk_block: v[12],
                spk_power: v[18],
                spk_vote: v[21],
                broca: typeof v[19] == 'string' ? v[19] : '0,0',
                liq_broca: v[29],
                pow_broca: v[28],
                tick: v[13],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        })
        .catch(function (err) {
          console.log(err)
        })
    }
  },
  {
    path: "/broca/@:un",
    func: function (req, res, next, context) {
      const { getPathNum, getPathObj, config, RAM, VERSION } = context;
      let un = req.params.un,
        bal = getPathNum(['balances', un]),
        cbal = getPathNum(['cbalances', un]),
        claims = getPathObj(['snap', un]),
        pb = getPathNum(['pow', un]),
        lp = getPathObj(['granted', un]),
        lg = getPathObj(['granting', un]),
        contracts = getPathObj(['contracts', un]),
        incol = getPathNum(['col', un]), //collateral
        gp = getPathNum(['gov', un]),
        pup = getPathObj(['up', un]),
        pdown = getPathObj(['down', un]),
        pspk = getPathNum(['spk', un]),
        pspkb = getPathNum(['spkb', un]),
        tick = getPathObj(['dex', 'hive', 'tick']),
        powdown = getPathObj(['powd', un]),
        govdown = getPathObj(['govd', un]),
        pspowdown = getPathObj(['spowd', un]),
        pbpowdown = getPathObj(['bpowd', un]),
        chron = getPathObj(['chrono']),
        ppubKey = getPathObj(['authorities', un]),
        pspow = getPathNum(['spow', un]),
        pbroca = getPathObj(["broca", un]),
        pChannels = getPathObj(["proffer", un]),
        pContract = getPathObj(["contract", un]),
        pspkVote = getPathObj(["spkVote", un]),
        pNode = getPathObj(["markets", "node", un]),
        pStorage = getPathObj(["service", "IPFS", un]),
        pcspk = getPathNum(['cspk', un]),
        pbpow = getPathNum(['bpow', un]),
        plbroca = getPathNum(["lbroca", un])
      res.setHeader('Content-Type', 'application/json');
      Promise.all([bal, pb, lp, contracts, incol, gp, pup, pdown, lg, cbal, claims, pspk, pspkb, tick, powdown, govdown, chron, ppubKey, pspow, pbroca, pChannels, pspkVote, pContract, pStorage, pNode, pcspk, pspowdown, pbpowdown, pbpow, plbroca])
        .then(function (v) {
          var arr = []
          for (var i in v[3]) {
            var c = v[3][i]
            if (c.partial) {
              c.partials = []
              for (var p in c.partial) {
                var j = c.partial[p]
                j.txid = p
                c.partials.push(j)
              }
            }
            arr.push(c)
          }
          const pubKey = typeof v[17] == 'string' ? v[17] : 'NA'
          var power_downs = v[14]
          if (power_downs) {
            for (var pd in power_downs) {
              power_downs[pd] = v[16][pd]
            }
          }
          var spower_downs = v[26]
          if (spower_downs) {
            for (var pd in power_downs) {
              spower_downs[pd] = v[16][pd]
            }
          }
          var bpower_downs = v[27]
          if (bpower_downs) {
            for (var pd in power_downs) {
              bpower_downs[pd] = v[16][pd]
            }
          }
          var granted = v[2]
          var granting = v[8]
          if (!granted.t) granted.t = 0
          if (!granting.t) granting.t = 0
          res.send(
            JSON.stringify(
              {
                name: un,
                balance: v[0],
                claim: v[9],
                claim_spk: v[25],
                drop: {
                  availible: {
                    amount: 0,
                    precision: 3,
                    token: "LARYNX",
                  },
                  last_claim: v[10].l || 0,
                  total_claims: v[10].t || 0,
                }, //v[10],
                poweredUp: v[1],
                granted,
                granting,
                heldCollateral: v[4],
                contracts: arr,
                channels: v[20],
                file_contracts: v[22],
                storage: v[23],
                spknode: v[24],
                pubKey,
                up: v[6],
                down: v[7],
                power_downs,
                spower_downs,
                bpower_downs,
                gov_downs: v[15],
                gov: v[5],
                spk: v[11],
                spk_block: v[12],
                spk_power: v[18],
                spk_vote: v[21],
                broca: typeof v[19] == 'string' ? v[19] : '0,0',
                liq_broca: v[29],
                pow_broca: v[28],
                tick: v[13],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        })
        .catch(function (err) {
          console.log(err)
        })
    }
  },
  {
    path: "/api/contract/:to/:from/:id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context
      let to = req.params.to || ''
      let from = req.params.from || ''
      let id = req.params.id || ''
      res.setHeader("Content-Type", "application/json");
      if (from && to && id) {
        const proffer = getPathObj(["proffer", to, from, id])
        const partial = getPathObj(["partial_updates", id.split(':')[2]])
        Promise.all([proffer, partial]).then((mem) => {
          res.send(
            JSON.stringify(
              {
                proffer: mem[0],
                partial_status: mem[1],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        });
      } else {
        res.send(
          JSON.stringify(
            {
              error: 'Missing search parameters'
            },
            null,
            3
          )
        );
      }
    }
  },
  {
    path: "/api/fileContract/:id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      let id = req.params.id,
        cpp = getPathObj(["cPointers", id]),
        statsp = getPathObj(["stats"]);
      Promise.all([cpp, statsp])
        .then((mem) => {
          let stats = mem[1]
          if (typeof mem[0] != "string") {
            res.send(
              JSON.stringify(
                {
                  result: 'Contract Not Found',
                  head_block: RAM.head,
                  behind: RAM.behind,
                  node: config.username,
                  VERSION,
                  realtime: stats.realtime,
                },
                null,
                3
              )
            )
            return
          }
          let contractp = getPathObj(["contract", mem[0], id])
          Promise.all([contractp])
            .then((contract) => {
              res.send(
                JSON.stringify(
                  {
                    result: contract[0],
                    head_block: RAM.head,
                    behind: RAM.behind,
                    node: config.username,
                    VERSION,
                    realtime: stats.realtime,
                  },
                  null,
                  3
                )
              )
            })
        })
    }
  },
  {
    path: "/api/file/:id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      let id = req.params.id
      id = id.split("").reverse().join("")
      let cpp = getPathObj(["IPFS", id]),
        statsp = getPathObj(["stats"]);
      Promise.all([cpp, statsp])
        .then((mem) => {
          if (typeof mem[0] != 'string') {
            return res.send(
              JSON.stringify(
                {
                  result: 'Not found',
                  head_block: RAM.head,
                  behind: RAM.behind,
                  node: config.username,
                  VERSION,
                  realtime: mem[1].realtime,
                },
                null,
                3
              )
            )
          }
          let stats = mem[1], party1, contract
          try {
            party1 = mem[0].split(',')[0]
            contract = mem[0].split(',')[1]
          } catch (error) {
            console.log(error)
            party1 = 'n'
            contract = 'n'
          }
          let contractp = getPathObj(["contract", party1, contract])
          Promise.all([contractp])
            .then((contract) => {
              return res.send(
                JSON.stringify(
                  {
                    result: contract[0],
                    head_block: RAM.head,
                    behind: RAM.behind,
                    node: config.username,
                    VERSION,
                    realtime: mem[1].realtime,
                  },
                  null,
                  3
                )
              )
            })
        })
    }
  },
  {
    path: "/spk/runners",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      store.get(["runners"], function (err, obj) {
        var runners = obj,
          result = [];
        for (var a in runners) {
          var node = {}
          node.account = a;
          result.push(node);
        }
        res.send(
          JSON.stringify(
            {
              result,
              runners: result,
              latest: [{ api: `${config.domain}/spk` }],
              node: config.username,
              head_block: RAM.head,
              behind: RAM.behind,
              VERSION,
            },
            null,
            3
          )
        );
      });
    }
  },
  {
    path: "/spk/markets",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      let markets = getPathObj(["markets"]),
        stats = getPathObj(["stats"]),
        pVal = getPathObj(["val"]),
        pIPFS = getPathObj(["service", 'IPFS']);
      res.setHeader("Content-Type", "application/json");
      Promise.all([markets, stats, pVal, pIPFS])
        .then(function (v) {
          res.send(
            JSON.stringify(
              {
                markets: v[0],
                validators: v[2],
                stats: v[1],
                ipfs_services: v[3],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  },
  {
    path: "/spk/queue",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      store.get(["queue"], function (err, obj) {
        var queue = obj;
        res.send(
          JSON.stringify(
            {
              queue,
              node: config.username,
              head_block: RAM.head,
              behind: RAM.behind,
              VERSION,
            },
            null,
            3
          )
        );
      });
    }
  },
  {
    path: "/spk/api/protocol",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      store.get(["queue"], function (err, obj) {
        res.send(
          JSON.stringify(
            {
              consensus: obj,
              prefix: config.prefix + "spk_",
              node: config.username,
              multisig: config.msaccount,
              precision: config.precision,
              token: "SPK",
              jsontoken: 'spk',
              memoKey: config.msPubMemo,
              features: config.featuresModelSpk,
              votable: config.votable,
              head_block: RAM.head,
              behind: RAM.behind,
              info: "/markets will return node information and published APIs for the consensus nodes, you may check these other APIs to ensure that the information in the API is in consensus.\nThe prefix is used to address this tokens architecture built on Hive.",
              VERSION,
            },
            null,
            3
          )
        );
      });
    }
  },
  {
    path: "/spk/api/status/:txid",
    func: function (req, res, next, context) {
      const { status, config, RAM, VERSION } = context;
      let txid = req.params.txid;
      res.setHeader("Content-Type", "application/json");
      res.send(
        JSON.stringify(
          {
            txid,
            status:
              status[txid] ||
              `This TransactionID either has not yet been processed, or was missed by the system due to formatting errors. Wait 70 seconds and try again. This API only keeps these records for a maximum of ${config.history * 3
              } seconds`,
            node: config.username,
            head_block: RAM.head,
            behind: RAM.behind,
            VERSION,
          },
          null,
          3
        )
      );
    }
  },
  {
    path: "/broca/runners",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      store.get(["runners"], function (err, obj) {
        var runners = obj,
          result = [];
        for (var a in runners) {
          var node = {}
          node.account = a;
          result.push(node);
        }
        res.send(
          JSON.stringify(
            {
              result,
              runners: result,
              latest: [{ api: `${config.domain}/broca` }],
              node: config.username,
              head_block: RAM.head,
              behind: RAM.behind,
              VERSION,
            },
            null,
            3
          )
        );
      });
    }
  },
  {
    path: "/broca/markets",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      let markets = getPathObj(["markets"]),
        stats = getPathObj(["stats"]),
        pVal = getPathObj(["val"]),
        pIPFS = getPathObj(["service", 'IPFS']);
      res.setHeader("Content-Type", "application/json");
      Promise.all([markets, stats, pVal, pIPFS])
        .then(function (v) {
          res.send(
            JSON.stringify(
              {
                markets: v[0],
                validators: v[2],
                stats: v[1],
                ipfs_services: v[3],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  },
  {
    path: "/broca/queue",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      store.get(["queue"], function (err, obj) {
        var queue = obj;
        res.send(
          JSON.stringify(
            {
              queue,
              node: config.username,
              head_block: RAM.head,
              behind: RAM.behind,
              VERSION,
            },
            null,
            3
          )
        );
      });
    }
  },
  {
    path: "/broca/api/protocol",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      store.get(["queue"], function (err, obj) {
        var feed = obj;
        res.send(
          JSON.stringify(
            {
              consensus: obj,
              prefix: config.prefix + "broca_",
              node: config.username,
              multisig: config.msaccount,
              precision: 0,
              token: "BROCA",
              jsontoken: 'broca',
              memoKey: config.msPubMemo,
              features: config.featuresModelBroca,
              votable: config.votable,
              head_block: RAM.head,
              behind: RAM.behind,
              info: "/markets will return node information and published APIs for the consensus nodes, you may check these other APIs to ensure that the information in the API is in consensus.\nThe prefix is used to address this tokens architecture built on Hive.",
              VERSION,
            },
            null,
            3
          )
        );
      });
    }
  },
  {
    path: "/broca/api/status/:txid",
    func: function (req, res, next, context) {
      const { status, config, RAM, VERSION } = context;
      let txid = req.params.txid;
      res.setHeader("Content-Type", "application/json");
      res.send(
        JSON.stringify(
          {
            txid,
            status:
              status[txid] ||
              `This TransactionID either has not yet been processed, or was missed by the system due to formatting errors. Wait 70 seconds and try again. This API only keeps these records for a maximum of ${config.history * 3
              } seconds`,
            node: config.username,
            head_block: RAM.head,
            behind: RAM.behind,
            VERSION,
          },
          null,
          3
        )
      );
    }
  },
  {
    path: "/services",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      store.get(["services"], function (err, obj) {
        const services = Object.keys(obj)
        res.send(
          JSON.stringify(
            {
              services: services,
              node: config.username,
              head_block: RAM.head,
              behind: RAM.behind,
              VERSION,
            },
            null,
            3
          )
        )
      })
    }
  },
  {
    path: "/spk/dex",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var Pdex = getPathObj(["dexs"]);
      var Pstats = getPathObj(["stats"]);
      var PQueue = getPathObj(["queue"]);
      res.setHeader("Content-Type", "application/json");
      Promise.all([Pdex, Pstats, PQueue])
        .then(function (v) {
          var markets = v[0];
          if (!markets.hive) markets.hive = {};
          if (!markets.hbd) markets.hbd = {};
          markets.hive.sells = [];
          markets.hive.buys = [];
          markets.hbd.sells = [];
          markets.hbd.buys = [];
          for (item in v[0].hive.sellOrders) {
            markets.hive.sellOrders[item].key = item;
            var order = {};
            for (let key in markets.hive.sellOrders[item]) {
              order[key] = markets.hive.sellOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: config.precision,
              token: 'SPK',
            };
            order.feenai = {
              amount: order.fee,
              precision: config.precision,
              token: "SPK",
            };
            markets.hive.sells.push(order);
          }
          for (item in v[0].hive.buyOrders) {
            markets.hive.buyOrders[item].key = item;
            var order = {};
            for (let key in markets.hive.buyOrders[item]) {
              order[key] = markets.hive.buyOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: config.precision,
              token: "SPK",
            };
            order.feenai = {
              amount: order.fee,
              precision: config.precision,
              token: "SPK",
            };
            markets.hive.buys.push(order);
          }
          for (item in v[0].hbd.sellOrders) {
            markets.hbd.sellOrders[item].key = item;
            var order = {};
            for (let key in markets.hbd.sellOrders[item]) {
              order[key] = markets.hbd.sellOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: config.precision,
              token: "SPK",
            };
            order.feenai = {
              amount: order.fee,
              precision: config.precision,
              token: "SPK",
            };
            markets.hbd.sells.push(order);
          }
          for (item in v[0].hbd.buyOrders) {
            markets.hbd.buyOrders[item].key = item;
            var order = {};
            for (let key in markets.hbd.buyOrders[item]) {
              order[key] = markets.hbd.buyOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: config.precision,
              token: "SPK",
            };
            order.feenai = {
              amount: order.fee,
              precision: config.precision,
              token: "SPK",
            };
            markets.hbd.buys.push(order);
          }
          delete markets.hbd.buyOrders;
          delete markets.hbd.sellOrders;
          delete markets.hive.buyOrders;
          delete markets.hbd.sellOrders;
          res.send(
            JSON.stringify(
              {
                markets,
                stats: v[1],
                queue: v[2],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  },
  {
    path: "/broca/dex",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var Pdex = getPathObj(["dexb"]);
      var Pstats = getPathObj(["stats"]);
      var PQueue = getPathObj(["queue"]);
      res.setHeader("Content-Type", "application/json");
      Promise.all([Pdex, Pstats, PQueue])
        .then(function (v) {
          var markets = v[0];
          if (!markets.hive) markets.hive = {};
          if (!markets.hbd) markets.hbd = {};
          markets.hive.sells = [];
          markets.hive.buys = [];
          markets.hbd.sells = [];
          markets.hbd.buys = [];
          for (item in v[0].hive.sellOrders) {
            markets.hive.sellOrders[item].key = item;
            var order = {};
            for (let key in markets.hive.sellOrders[item]) {
              order[key] = markets.hive.sellOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: 0,
              token: 'BROCA',
            };
            order.feenai = {
              amount: order.fee,
              precision: 0,
              token: "BROCA",
            };
            markets.hive.sells.push(order);
          }
          for (item in v[0].hive.buyOrders) {
            markets.hive.buyOrders[item].key = item;
            var order = {};
            for (let key in markets.hive.buyOrders[item]) {
              order[key] = markets.hive.buyOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: 0,
              token: "BROCA",
            };
            order.feenai = {
              amount: order.fee,
              precision: 0,
              token: "SPK",
            };
            markets.hive.buys.push(order);
          }
          for (item in v[0].hbd.sellOrders) {
            markets.hbd.sellOrders[item].key = item;
            var order = {};
            for (let key in markets.hbd.sellOrders[item]) {
              order[key] = markets.hbd.sellOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: 0,
              token: "BROCA",
            };
            order.feenai = {
              amount: order.fee,
              precision: 0,
              token: "SPK",
            };
            markets.hbd.sells.push(order);
          }
          for (item in v[0].hbd.buyOrders) {
            markets.hbd.buyOrders[item].key = item;
            var order = {};
            for (let key in markets.hbd.buyOrders[item]) {
              order[key] = markets.hbd.buyOrders[item][key];
            }
            order.hivenai = {
              amount: order.hive,
              precision: 3,
              token: "HIVE",
            };
            order.hbdnai = {
              amount: order.hbd,
              precision: 3,
              token: "HBD",
            };
            order.amountnai = {
              amount: order.amount,
              precision: 0,
              token: "BROCA",
            };
            order.feenai = {
              amount: order.fee,
              precision: 0,
              token: "BROCA",
            };
            markets.hbd.buys.push(order);
          }
          delete markets.hbd.buyOrders;
          delete markets.hbd.sellOrders;
          delete markets.hive.buyOrders;
          delete markets.hbd.sellOrders;
          res.send(
            JSON.stringify(
              {
                markets,
                stats: v[1],
                queue: v[2],
                node: config.username,
                head_block: RAM.head,
                behind: RAM.behind,
                VERSION,
              },
              null,
              3
            )
          );
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  },
  {
    path: "/spk/api/tickers",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexs"]);
      var stats = getPathObj(["stats"]);
      res.setHeader("Content-Type", "application/json");
      Promise.all([dex, stats])
        .then(function (v) {
          var info = {
            hive: {
              low: v[0].hive.tick,
              bv: 0,
              tv: 0,
              high: v[0].hive.tick,
              bid: 0,
              ask: 999999999,
            },
            hbd: {
              low: v[0].hbd.tick,
              high: v[0].hbd.tick,
              bv: 0,
              tv: 0,
              bid: 0,
              ask: 999999999,
            },
          };
          for (item in v[0].hive.his) {
            if (v[0].hive.his[item].block > v[1].lastIBlock - 28800) {
              // if (v[0].hive.his[item].block < hive.open){
              //     hive.open = v[0].hive.his[item].block
              //     hive.o = parseFloat(v[0].hive.his[item].rate)
              //     hive.tv += v[0].hive.his[item].amount
              //     hive.bv += v[0].hive.his[item].amount v[0].hive.his[item].rate
              // }
              if (v[0].hive.his[item].rate < info.hive.low) {
                info.hive.low = v[0].hive.his[item].rate;
              }
              if (v[0].hive.his[item].rate > info.hive.high) {
                info.hive.high = v[0].hive.his[item].rate;
              }
              info.hive.tv += parseFloat(v[0].hive.his[item].amount);
              info.hive.bv += parseFloat(
                parseFloat(v[0].hive.his[item].amount) *
                parseFloat(v[0].hive.his[item].rate)
              ).toFixed(3);
            }
          }
          for (item in v[0].hbd.his) {
            if (v[0].hbd.his[item].block > v[1].lastIBlock - 28800) {
              if (v[0].hbd.his[item].rate < info.hbd.low) {
                info.hbd.low = v[0].hbd.his[item].rate;
              }
              if (v[0].hbd.his[item].rate > info.hbd.high) {
                info.hbd.high = v[0].hbd.his[item].rate;
              }
              info.hbd.tv += parseFloat(v[0].hbd.his[item].amount);
              info.hbd.bv += parseFloat(
                parseFloat(v[0].hbd.his[item].amount) *
                parseFloat(v[0].hbd.his[item].rate)
              ).toFixed(3);
            }
          }
          for (item in v[0].hbd.sellOrders) {
            if (parseFloat(v[0].hbd.sellOrders[item].rate) < info.hbd.ask) {
              info.hbd.ask = v[0].hbd.sellOrders[item].rate;
            }
          }
          for (item in v[0].hbd.buyOrders) {
            if (parseFloat(v[0].hbd.buyOrders[item].rate) > info.hbd.bid) {
              info.hbd.bid = v[0].hbd.buyOrders[item].rate;
            }
          }
          for (item in v[0].hive.sellOrders) {
            if (parseFloat(v[0].hive.sellOrders[item].rate) < info.hive.ask) {
              info.hive.ask = v[0].hive.sellOrders[item].rate;
            }
          }
          for (item in v[0].hive.buyOrders) {
            if (parseFloat(v[0].hive.buyOrders[item].rate) > info.hive.bid) {
              info.hive.bid = v[0].hive.buyOrders[item].rate;
            }
          }
          var hive = {
            ticker_id: `HIVE_SPK`,
            base_currency: "HIVE",
            target_currency: 'SPK',
            last_price: v[0].hive.tick,
            base_volume: parseFloat(parseFloat(info.hive.bv) / 1000).toFixed(3),
            target_volume: parseFloat(parseFloat(info.hive.tv) / 1000).toFixed(3),
            bid: info.hive.bid,
            ask: info.hive.ask,
            high: info.hive.high,
            low: info.hive.low,
          },
            hbd = {
              ticker_id: `HBD_SPK`,
              base_currency: "HBD",
              target_currency: 'SPK',
              last_price: v[0].hbd.tick,
              base_volume: parseFloat(parseFloat(info.hbd.bv) / 1000).toFixed(3),
              target_volume: parseFloat(parseFloat(info.hbd.tv) / 1000).toFixed(3),
              bid: info.hbd.bid,
              ask: info.hbd.ask,
              high: info.hbd.high,
              low: info.hbd.low,
            };
          res.send(JSON.stringify([hive, hbd], null, 3));
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  },
  {
    path: "/broca/api/tickers",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexb"]);
      var stats = getPathObj(["stats"]);
      res.setHeader("Content-Type", "application/json");
      Promise.all([dex, stats])
        .then(function (v) {
          var info = {
            hive: {
              low: v[0].hive.tick,
              bv: 0,
              tv: 0,
              high: v[0].hive.tick,
              bid: 0,
              ask: 999999999,
            },
            hbd: {
              low: v[0].hbd.tick,
              high: v[0].hbd.tick,
              bv: 0,
              tv: 0,
              bid: 0,
              ask: 999999999,
            },
          };
          for (item in v[0].hive.his) {
            if (v[0].hive.his[item].block > v[1].lastIBlock - 28800) {
              // if (v[0].hive.his[item].block < hive.open){
              //     hive.open = v[0].hive.his[item].block
              //     hive.o = parseFloat(v[0].hive.his[item].rate)
              //     hive.tv += v[0].hive.his[item].amount
              //     hive.bv += v[0].hive.his[item].amount v[0].hive.his[item].rate
              // }
              if (v[0].hive.his[item].rate < info.hive.low) {
                info.hive.low = v[0].hive.his[item].rate;
              }
              if (v[0].hive.his[item].rate > info.hive.high) {
                info.hive.high = v[0].hive.his[item].rate;
              }
              info.hive.tv += parseFloat(v[0].hive.his[item].amount);
              info.hive.bv += parseFloat(
                parseFloat(v[0].hive.his[item].amount) *
                parseFloat(v[0].hive.his[item].rate)
              ).toFixed(3);
            }
          }
          for (item in v[0].hbd.his) {
            if (v[0].hbd.his[item].block > v[1].lastIBlock - 28800) {
              if (v[0].hbd.his[item].rate < info.hbd.low) {
                info.hbd.low = v[0].hbd.his[item].rate;
              }
              if (v[0].hbd.his[item].rate > info.hbd.high) {
                info.hbd.high = v[0].hbd.his[item].rate;
              }
              info.hbd.tv += parseFloat(v[0].hbd.his[item].amount);
              info.hbd.bv += parseFloat(
                parseFloat(v[0].hbd.his[item].amount) *
                parseFloat(v[0].hbd.his[item].rate)
              ).toFixed(3);
            }
          }
          for (item in v[0].hbd.sellOrders) {
            if (parseFloat(v[0].hbd.sellOrders[item].rate) < info.hbd.ask) {
              info.hbd.ask = v[0].hbd.sellOrders[item].rate;
            }
          }
          for (item in v[0].hbd.buyOrders) {
            if (parseFloat(v[0].hbd.buyOrders[item].rate) > info.hbd.bid) {
              info.hbd.bid = v[0].hbd.buyOrders[item].rate;
            }
          }
          for (item in v[0].hive.sellOrders) {
            if (parseFloat(v[0].hive.sellOrders[item].rate) < info.hive.ask) {
              info.hive.ask = v[0].hive.sellOrders[item].rate;
            }
          }
          for (item in v[0].hive.buyOrders) {
            if (parseFloat(v[0].hive.buyOrders[item].rate) > info.hive.bid) {
              info.hive.bid = v[0].hive.buyOrders[item].rate;
            }
          }
          var hive = {
            ticker_id: `HIVE_BROCA`,
            base_currency: "HIVE",
            target_currency: 'BROCA',
            last_price: v[0].hive.tick,
            base_volume: parseFloat(parseFloat(info.hive.bv) / 1000).toFixed(3),
            target_volume: parseFloat(parseFloat(info.hive.tv) / 1000).toFixed(3),
            bid: info.hive.bid,
            ask: info.hive.ask,
            high: info.hive.high,
            low: info.hive.low,
          },
            hbd = {
              ticker_id: `HBD_BROCA`,
              base_currency: "HBD",
              target_currency: 'BROCA',
              last_price: v[0].hbd.tick,
              base_volume: parseFloat(parseFloat(info.hbd.bv) / 1000).toFixed(3),
              target_volume: parseFloat(parseFloat(info.hbd.tv) / 1000).toFixed(3),
              bid: info.hbd.bid,
              ask: info.hbd.ask,
              high: info.hbd.high,
              low: info.hbd.low,
            };
          res.send(JSON.stringify([hive, hbd], null, 3));
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  },
  {
    path: "/spk/api/orderbook",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexs"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
      var pair = req.params.ticker_id || req.query.ticker_id;
      const depth = parseInt(req.query.depth) || 50;
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_SPK`:
          orderbook.ticker_id = `HIVE_SPK`;
          makeBook(depth, [dex, stats]);
          break;
        case `HBD_SPK`:
          orderbook.ticker_id = `HBD_SPK`;
          makeBook(depth, [dex, stats]);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                ERROR: `ticker_id must be HIVE_SPK or HBD_SPK`,
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function makeBook(dep, promises) {
        var get = dep;
        if (!get) get = 50;
        const type = orderbook.ticker_id.split("_")[0].toLowerCase();
        Promise.all(promises)
          .then(function (v) {
            var count1 = 0,
              count2 = 0;
            for (item in v[0][type].sellOrders) {
              orderbook.asks.push([
                v[0][type].sellOrders[item].rate,
                parseFloat(v[0][type].sellOrders[item].amount / 1000).toFixed(3),
              ]);
              count1++;
              if (count1 == get) break;
            }
            for (item in v[0][type].buyOrders) {
              orderbook.bids.push([
                v[0][type].buyOrders[item].rate,
                parseFloat(v[0][type].buyOrders[item].amount / 1000).toFixed(3),
              ]);
              count2++;
              if (count2 == get) break;
            }
            res.send(
              JSON.stringify(
                {
                  asks: orderbook.asks,
                  bids: orderbook.bids,
                  timestamp: orderbook.timestamp,
                  ticker_id: orderbook.ticker_id,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/broca/api/orderbook",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexb"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
      var pair = req.params.ticker_id || req.query.ticker_id;
      const depth = parseInt(req.query.depth) || 50;
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_BROCA`:
          orderbook.ticker_id = `HIVE_BROCA`;
          makeBook(depth, [dex, stats]);
          break;
        case `HBD_BROCA`:
          orderbook.ticker_id = `HBD_BROCA`;
          makeBook(depth, [dex, stats]);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                ERROR: `ticker_id must be HIVE_BROCA or HBD_BROCA`,
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function makeBook(dep, promises) {
        var get = dep;
        if (!get) get = 50;
        const type = orderbook.ticker_id.split("_")[0].toLowerCase();
        Promise.all(promises)
          .then(function (v) {
            var count1 = 0,
              count2 = 0;
            for (item in v[0][type].sellOrders) {
              orderbook.asks.push([
                v[0][type].sellOrders[item].rate,
                parseFloat(v[0][type].sellOrders[item].amount / 1000).toFixed(3),
              ]);
              count1++;
              if (count1 == get) break;
            }
            for (item in v[0][type].buyOrders) {
              orderbook.bids.push([
                v[0][type].buyOrders[item].rate,
                parseFloat(v[0][type].buyOrders[item].amount / 1000).toFixed(3),
              ]);
              count2++;
              if (count2 == get) break;
            }
            res.send(
              JSON.stringify(
                {
                  asks: orderbook.asks,
                  bids: orderbook.bids,
                  timestamp: orderbook.timestamp,
                  ticker_id: orderbook.ticker_id,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/spk/api/orderbook/:ticker_id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexs"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
      var pair = req.params.ticker_id || req.query.ticker_id;
      const depth = parseInt(req.query.depth) || 50;
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_SPK`:
          orderbook.ticker_id = `HIVE_SPK`;
          makeBook(depth, [dex, stats]);
          break;
        case `HBD_SPK`:
          orderbook.ticker_id = `HBD_SPK`;
          makeBook(depth, [dex, stats]);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                ERROR: `ticker_id must be HIVE_SPK or HBD_SPK`,
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function makeBook(dep, promises) {
        var get = dep;
        if (!get) get = 50;
        const type = orderbook.ticker_id.split("_")[0].toLowerCase();
        Promise.all(promises)
          .then(function (v) {
            var count1 = 0,
              count2 = 0;
            for (item in v[0][type].sellOrders) {
              orderbook.asks.push([
                v[0][type].sellOrders[item].rate,
                parseFloat(v[0][type].sellOrders[item].amount / 1000).toFixed(3),
              ]);
              count1++;
              if (count1 == get) break;
            }
            for (item in v[0][type].buyOrders) {
              orderbook.bids.push([
                v[0][type].buyOrders[item].rate,
                parseFloat(v[0][type].buyOrders[item].amount / 1000).toFixed(3),
              ]);
              count2++;
              if (count2 == get) break;
            }
            res.send(
              JSON.stringify(
                {
                  asks: orderbook.asks,
                  bids: orderbook.bids,
                  timestamp: orderbook.timestamp,
                  ticker_id: orderbook.ticker_id,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/broca/api/orderbook/:ticker_id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexb"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        bids: [],
        asks: [],
      };
      var pair = req.params.ticker_id || req.query.ticker_id;
      const depth = parseInt(req.query.depth) || 50;
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_BROCA`:
          orderbook.ticker_id = `HIVE_BROCA`;
          makeBook(depth, [dex, stats]);
          break;
        case `HBD_BROCA`:
          orderbook.ticker_id = `HBD_BROCA`;
          makeBook(depth, [dex, stats]);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                ERROR: `ticker_id must be HIVE_BROCA or HBD_BROCA`,
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function makeBook(dep, promises) {
        var get = dep;
        if (!get) get = 50;
        const type = orderbook.ticker_id.split("_")[0].toLowerCase();
        Promise.all(promises)
          .then(function (v) {
            var count1 = 0,
              count2 = 0;
            for (item in v[0][type].sellOrders) {
              orderbook.asks.push([
                v[0][type].sellOrders[item].rate,
                parseFloat(v[0][type].sellOrders[item].amount / 1000).toFixed(3),
              ]);
              count1++;
              if (count1 == get) break;
            }
            for (item in v[0][type].buyOrders) {
              orderbook.bids.push([
                v[0][type].buyOrders[item].rate,
                parseFloat(v[0][type].buyOrders[item].amount / 1000).toFixed(3),
              ]);
              count2++;
              if (count2 == get) break;
            }
            res.send(
              JSON.stringify(
                {
                  asks: orderbook.asks,
                  bids: orderbook.bids,
                  timestamp: orderbook.timestamp,
                  ticker_id: orderbook.ticker_id,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/spk/api/pairs",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      const pairs = [
        {
          ticker_id: `HIVE_SPK`,
          base: "HIVE",
          target: 'SPK',
        },
        {
          ticker_id: `HBD_SPK`,
          base: "HBD",
          target: 'SPK',
        },
      ];
      res.send(JSON.stringify(pairs, null, 3));
    }
  },
  {
    path: "/broca/api/pairs",
    func: function (req, res, next, context) {
      const { store, config, RAM, VERSION } = context;
      res.setHeader("Content-Type", "application/json");
      const pairs = [
        {
          ticker_id: `HIVE_BROCA`,
          base: "HIVE",
          target: 'BROCA',
        },
        {
          ticker_id: `HBD_BROCA`,
          base: "HBD",
          target: 'BROCA',
        },
      ];
      res.send(JSON.stringify(pairs, null, 3));
    }
  },
  {
    path: "/spk/api/historical",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexs"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        buys: [],
        sells: [],
      };
      /*
    {        
          trade_id:1234567,
          price:"50.1",
          base_volume:"0.1",
          target_volume:"1",
          trade_timestamp:"1700050000",
          type:"buy"
       }
    
        */
      var pair = req.params.ticker_id || req.query.ticker_id;
      const limit = parseInt(req.query.limit) || 50;
      var type = req.query.type;
      switch (type) {
        case "buy":
          type = ["buy"];
          break;
        case "ask":
          type = ["sell"];
          break;
        default:
          type = ["buy", "sell"];
          break;
      }
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_SPK`:
          getHistory([dex, stats], "hive", type, limit);
          break;
        case `HBD_SPK`:
          getHistory([dex, stats], "hbd", type, limit);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                error: "Ticker_ID is not supported",
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function getHistory(promises, pair, typ, lim) {
        Promise.all(promises)
          .then(function (v) {
            var buy = [],
              sell = [],
              countb = 0;
            counts = 0;
            if (v[0][pair].his)
              for (var item in v[0][pair].his) {
                const record = {
                  trade_id: v[0][pair].his[item].id,
                  price: v[0][pair].his[item].price,
                  base_volume: parseFloat(
                    parseInt(v[0][pair].his[item].base_vol) / 1000
                  ).toFixed(3),
                  target_volume: parseFloat(
                    parseInt(v[0][pair].his[item].target_vol) / 1000
                  ).toFixed(3),
                  trade_timestamp: v[0][pair].his[item].t,
                  type: v[0][pair].his[item].type,
                };
                if (record.type == "buy") {
                  countb++;
                  if (countb <= lim) {
                    buy.push(record);
                    if (counts == lim) break;
                  }
                } else {
                  counts++;
                  if (counts <= lim) {
                    sell.push(record);
                    if (countb == lim) break;
                  }
                }
              }
            if (typ.indexOf("buy") < 0) {
              buy = [];
            }
            if (typ.indexOf("sell") < 0) {
              sell = [];
            }

            res.send(
              JSON.stringify(
                {
                  sell,
                  buy,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/broca/api/historical",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexb"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        buys: [],
        sells: [],
      };
      /*
    {        
          trade_id:1234567,
          price:"50.1",
          base_volume:"0.1",
          target_volume:"1",
          trade_timestamp:"1700050000",
          type:"buy"
       }
    
        */
      var pair = req.params.ticker_id || req.query.ticker_id;
      const limit = parseInt(req.query.limit) || 50;
      var type = req.query.type;
      switch (type) {
        case "buy":
          type = ["buy"];
          break;
        case "ask":
          type = ["sell"];
          break;
        default:
          type = ["buy", "sell"];
          break;
      }
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_BROCA`:
          getHistory([dex, stats], "hive", type, limit);
          break;
        case `HBD_BROCA`:
          getHistory([dex, stats], "hbd", type, limit);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                error: "Ticker_ID is not supported",
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function getHistory(promises, pair, typ, lim) {
        Promise.all(promises)
          .then(function (v) {
            var buy = [],
              sell = [],
              countb = 0;
            counts = 0;
            if (v[0][pair].his)
              for (var item in v[0][pair].his) {
                const record = {
                  trade_id: v[0][pair].his[item].id,
                  price: v[0][pair].his[item].price,
                  base_volume: parseFloat(
                    parseInt(v[0][pair].his[item].base_vol) / 1000
                  ).toFixed(3),
                  target_volume: parseFloat(
                    parseInt(v[0][pair].his[item].target_vol) / 1000
                  ).toFixed(3),
                  trade_timestamp: v[0][pair].his[item].t,
                  type: v[0][pair].his[item].type,
                };
                if (record.type == "buy") {
                  countb++;
                  if (countb <= lim) {
                    buy.push(record);
                    if (counts == lim) break;
                  }
                } else {
                  counts++;
                  if (counts <= lim) {
                    sell.push(record);
                    if (countb == lim) break;
                  }
                }
              }
            if (typ.indexOf("buy") < 0) {
              buy = [];
            }
            if (typ.indexOf("sell") < 0) {
              sell = [];
            }

            res.send(
              JSON.stringify(
                {
                  sell,
                  buy,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/spk/api/historical/:ticker_id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexs"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        buys: [],
        sells: [],
      };
      /*
    {        
          trade_id:1234567,
          price:"50.1",
          base_volume:"0.1",
          target_volume:"1",
          trade_timestamp:"1700050000",
          type:"buy"
       }
    
        */
      var pair = req.params.ticker_id || req.query.ticker_id;
      const limit = parseInt(req.query.limit) || 50;
      var type = req.query.type;
      switch (type) {
        case "buy":
          type = ["buy"];
          break;
        case "ask":
          type = ["sell"];
          break;
        default:
          type = ["buy", "sell"];
          break;
      }
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_SPK`:
          getHistory([dex, stats], "hive", type, limit);
          break;
        case `HBD_SPK`:
          getHistory([dex, stats], "hbd", type, limit);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                error: "Ticker_ID is not supported",
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function getHistory(promises, pair, typ, lim) {
        Promise.all(promises)
          .then(function (v) {
            var buy = [],
              sell = [],
              countb = 0;
            counts = 0;
            if (v[0][pair].his)
              for (var item in v[0][pair].his) {
                const record = {
                  trade_id: v[0][pair].his[item].id,
                  price: v[0][pair].his[item].price,
                  base_volume: parseFloat(
                    parseInt(v[0][pair].his[item].base_vol) / 1000
                  ).toFixed(3),
                  target_volume: parseFloat(
                    parseInt(v[0][pair].his[item].target_vol) / 1000
                  ).toFixed(3),
                  trade_timestamp: v[0][pair].his[item].t,
                  type: v[0][pair].his[item].type,
                };
                if (record.type == "buy") {
                  countb++;
                  if (countb <= lim) {
                    buy.push(record);
                    if (counts == lim) break;
                  }
                } else {
                  counts++;
                  if (counts <= lim) {
                    sell.push(record);
                    if (countb == lim) break;
                  }
                }
              }
            if (typ.indexOf("buy") < 0) {
              buy = [];
            }
            if (typ.indexOf("sell") < 0) {
              sell = [];
            }

            res.send(
              JSON.stringify(
                {
                  sell,
                  buy,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/broca/api/historical/:ticker_id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexb"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        buys: [],
        sells: [],
      };
      /*
    {        
          trade_id:1234567,
          price:"50.1",
          base_volume:"0.1",
          target_volume:"1",
          trade_timestamp:"1700050000",
          type:"buy"
       }
    
        */
      var pair = req.params.ticker_id || req.query.ticker_id;
      const limit = parseInt(req.query.limit) || 50;
      var type = req.query.type;
      switch (type) {
        case "buy":
          type = ["buy"];
          break;
        case "ask":
          type = ["sell"];
          break;
        default:
          type = ["buy", "sell"];
          break;
      }
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_BROCA`:
          getHistory([dex, stats], "hive", type, limit);
          break;
        case `HBD_BROCA`:
          getHistory([dex, stats], "hbd", type, limit);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                error: "Ticker_ID is not supported",
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function getHistory(promises, pair, typ, lim) {
        Promise.all(promises)
          .then(function (v) {
            var buy = [],
              sell = [],
              countb = 0;
            counts = 0;
            if (v[0][pair].his)
              for (var item in v[0][pair].his) {
                const record = {
                  trade_id: v[0][pair].his[item].id,
                  price: v[0][pair].his[item].price,
                  base_volume: parseFloat(
                    parseInt(v[0][pair].his[item].base_vol) / 1000
                  ).toFixed(3),
                  target_volume: parseFloat(
                    parseInt(v[0][pair].his[item].target_vol) / 1000
                  ).toFixed(3),
                  trade_timestamp: v[0][pair].his[item].t,
                  type: v[0][pair].his[item].type,
                };
                if (record.type == "buy") {
                  countb++;
                  if (countb <= lim) {
                    buy.push(record);
                    if (counts == lim) break;
                  }
                } else {
                  counts++;
                  if (counts <= lim) {
                    sell.push(record);
                    if (countb == lim) break;
                  }
                }
              }
            if (typ.indexOf("buy") < 0) {
              buy = [];
            }
            if (typ.indexOf("sell") < 0) {
              sell = [];
            }

            res.send(
              JSON.stringify(
                {
                  sell,
                  buy,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/spk/api/recent/:ticker_id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexs"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        recents: [],
      };
      /*
    {        
          trade_id:1234567,
          price:"50.1",
          base_volume:"0.1",
          target_volume:"1",
          trade_timestamp:"1700050000",
          type:"buy"
       }
    
        */
      var pair = req.params.ticker_id || req.query.ticker_id;
      const limit = parseInt(req.query.limit) || 50;
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_SPK`:
          getHistory([dex, stats], "hive", limit);
          break;
        case `HBD_SPK`:
          getHistory([dex, stats], "hbd", limit);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                error: "Ticker_ID is not supported",
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function getHistory(promises, pair, lim) {
        Promise.all(promises)
          .then(function (v) {
            var his = [],
              count = 0;
            if (v[0][pair]?.his)
              for (var item in v[0][pair].his) {
                const record = {
                  trade_id: v[0][pair].his[item].id,
                  price: v[0][pair].his[item].price,
                  base_volume: parseFloat(
                    parseInt(v[0][pair].his[item].base_vol) / 1000
                  ).toFixed(3),
                  target_volume: parseFloat(
                    parseInt(v[0][pair].his[item].target_vol) / 1000
                  ).toFixed(3),
                  trade_timestamp: v[0][pair].his[item].t,
                  type: v[0][pair].his[item].type,
                };
                his.push(record);
                count++;
                if (count == limit) break;
              }
            res.send(
              JSON.stringify(
                {
                  recent_trades: his,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
  {
    path: "/broca/api/recent/:ticker_id",
    func: function (req, res, next, context) {
      const { getPathObj, config, RAM, VERSION } = context;
      var dex = getPathObj(["dexb"]);
      var stats = getPathObj(["stats"]);
      var orderbook = {
        timestamp: Date.now(),
        recents: [],
      };
      /*
    {        
          trade_id:1234567,
          price:"50.1",
          base_volume:"0.1",
          target_volume:"1",
          trade_timestamp:"1700050000",
          type:"buy"
       }
    
        */
      var pair = req.params.ticker_id || req.query.ticker_id;
      const limit = parseInt(req.query.limit) || 50;
      res.setHeader("Content-Type", "application/json");
      switch (pair) {
        case `HIVE_BROCA`:
          getHistory([dex, stats], "hive", limit);
          break;
        case `HBD_BROCA`:
          getHistory([dex, stats], "hbd", limit);
          break;
        default:
          res.send(
            JSON.stringify(
              {
                error: "Ticker_ID is not supported",
                node: config.username,
                VERSION,
              },
              null,
              3
            )
          );
          break;
      }
      function getHistory(promises, pair, lim) {
        Promise.all(promises)
          .then(function (v) {
            var his = [],
              count = 0;
            if (v[0][pair]?.his)
              for (var item in v[0][pair].his) {
                const record = {
                  trade_id: v[0][pair].his[item].id,
                  price: v[0][pair].his[item].price,
                  base_volume: parseFloat(
                    parseInt(v[0][pair].his[item].base_vol) / 1000
                  ).toFixed(3),
                  target_volume: parseFloat(
                    parseInt(v[0][pair].his[item].target_vol) / 1000
                  ).toFixed(3),
                  trade_timestamp: v[0][pair].his[item].t,
                  type: v[0][pair].his[item].type,
                };
                his.push(record);
                count++;
                if (count == limit) break;
              }
            res.send(
              JSON.stringify(
                {
                  recent_trades: his,
                  node: config.username,
                  head_block: RAM.head,
                  behind: RAM.behind,
                  VERSION,
                },
                null,
                3
              )
            );
          })
          .catch(function (err) {
            console.log(err);
          });
      }
    }
  },
]
const CustomChron = [
  {
    op: 'spower_down',
    func: function (b, passed, res, rej, num, prand, ints, context) {
      const { store, getPathNum } = context
      function sPowerDownOp(promies, from, delkey, num, id, b) {
        return new Promise((resolve, reject) => {
          Promise.all(promies)
            .then((bals) => {
              let lbal = bals[0],
                tpow = bals[1],
                pbal = bals[2],
                ops = [];
              if (pbal - b.amount < 0) {
                b.amount = pbal;
              }
              ops.push({
                type: "put",
                path: ["spk", from],
                data: lbal + b.amount,
              });
              ops.push({ type: "put", path: ["spow", from], data: pbal - b.amount });
              ops.push({ type: "put", path: ["spow", "t"], data: tpow - b.amount });
              ops.push({
                type: "put",
                path: ["feed", `${num}:vop_${id}`],
                data: `@${b.by}| powered down ${parseFloat(b.amount / 1000).toFixed(
                  3
                )} SPK`,
              });
              ops.push({ type: "del", path: ["chrono", delkey] });
              ops.push({ type: "del", path: ["spowd", b.by, delkey] });
              store.batch(ops, [resolve, reject]);
            })
            .catch((e) => {
              console.log(e);
            });
        })
      }
      let lbsp = getPathNum(["spk", b.by]),
        tspowp = getPathNum(["spow", "t"]),
        spowp = getPathNum(["spow", b.by]);
      sPowerDownOp(
        [lbsp, tspowp, spowp],
        b.by,
        passed.delKey,
        num,
        passed.delKey.split(":")[1],
        b
      ).then((x) => res(x));
    }
  },
  {
    op: 'bpower_down',
    func: function (b, passed, res, rej, num, prand, ints, context) {
      const { store, getPathNum } = context
      function bPowerDownOp(promies, from, delkey, num, id, b) {
        return new Promise((resolve, reject) => {
          Promise.all(promies)
            .then((bals) => {
              let lbal = bals[0],
                tpow = bals[1],
                pbal = bals[2],
                ops = [];
              if (pbal - b.amount < 0) {
                b.amount = pbal;
              }
              ops.push({
                type: "put",
                path: ["lboca", from],
                data: lbal + b.amount,
              });
              ops.push({ type: "put", path: ["bpow", from], data: pbal - b.amount });
              ops.push({ type: "put", path: ["bpow", "t"], data: tpow - b.amount });
              ops.push({
                type: "put",
                path: ["feed", `${num}:vop_${id}`],
                data: `@${b.by}| powered down ${parseFloat(b.amount / 1000).toFixed(
                  3
                )} BROCA`,
              });
              ops.push({ type: "del", path: ["chrono", delkey] });
              ops.push({ type: "del", path: ["bpowd", b.by, delkey] });
              store.batch(ops, [resolve, reject]);
            })
            .catch((e) => {
              console.log(e);
            });
        });
      }
      let lbsp = getPathNum(["lbroca", b.by]),
        tspowp = getPathNum(["bpow", "t"]),
        spowp = getPathNum(["bpow", b.by]);
      bPowerDownOp(
        [lbsp, tspowp, spowp],
        b.by,
        passed.delKey,
        num,
        passed.delKey.split(":")[1],
        b
      ).then((x) => res(x));
    }
  },
  {
    op: 'expires',
    func: function (b, passed, res, rej, num, prand, ints, context) {
      const { store, release } = context;
      release(b.from, b.txid, num, 'dexs', 'spk');
      store.batch(
        [{ type: "del", path: ["chrono", passed.delKey] }],
        [res, rej, "info"]
      );
    }
  },
  {
    op: 'expireb',
    func: function (b, passed, res, rej, num, prand, ints, context) {
      const { store, release } = context;
      release(b.from, b.txid, num, 'dexb', 'lbroca');
      store.batch(
        [{ type: "del", path: ["chrono", passed.delKey] }],
        [res, rej, "info"]
      );
    }
  },
  {
    op: 'contract_close',
    func: function (b, passed, res, rej, num, prand, ints, context) {
      const { store, getPathObj, Base64 } = context;
      const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
        if (typeof last != "string") last = '0,0'
        const last_calc = Base64.toNumber(last.split(',')[1])
        const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc)) / (pow * (stats.broca_daily_trend > 1000 ? stats.broca_daily_trend : 1000))) //revisit 
        var total = parseInt(last.split(',')[0]) + accured + add
        if (total > (pow * 1000)) total = (pow * 1000)
        return `${total},${Base64.fromNumber(bn)}`
      }
      function extend(json, from, active, pc, contextD) {
        const { store, getPathObj, postToDiscord, config, getPathNum, chronAssign } = contextD
        if (json.broca && json.id && json.file_owner) {
          var Pbroca = getPathObj(["broca", from]);
          var Ppow = getPathNum(["bpow", from])
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
              let cidsSorted = Object.keys(contract.df).sort()
              let cidsMetaData = []
              let cidsFlaggedForDeletion = []
              try {
                cidsMetaData = contract.m.split(',').splice(1)
              } catch (e) {
                console.log("Error parsing metadata:", e);
              }
              for (var i = 0; i < cidsMetaData.length; i++) {
                if (cidsMetaData[(i * 4) + 1] && cidsMetaData[(i * 4) + 1].split('.').length > 1 && cidsMetaData[(i * 4) + 1].split('.')[1] == "8") {
                  cidsFlaggedForDeletion.push(cidsSorted[i])
                }
              }
              let deletePromise = new Promise((resolve, reject) => {
                if (cidsFlaggedForDeletion.length) {
                  exports.delete_files({ cids: cidsFlaggedForDeletion, block_num: json.block_num, transaction_id: json.transaction_id }, contract.t, true, [resolve, reject, 0])
                } else {
                  resolve([])
                }
              })
              deletePromise.then(contracts => {
                if (contracts.length) {
                  contract = contracts[contracts.i]
                }
                if (from == contract.t && parseInt(json.power) > 0) {
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
                    store.batch(ops, pc);
                  } else {
                    json.broca -= debt
                  }
                }
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
                  //console.log(ops)
                  store.batch(ops, pc);
                })
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
      function contractClose(promies, delkey, num, id, b) {
        return new Promise((resolve, reject) => {
          Promise.all(promies)
            .then((mem) => {
              //console.log(delkey)
              let contract = mem[0],
                stats = mem[1],
                ops = [],
                bytes = 0,
                broca = broca_calc(mem[2], mem[3], stats, num),
                renew = contract.m ? (contract.m.indexOf('"') >= 0 ? Base64.toNumber(JSON.parse(contract.m)[0]) & 1 : Base64.toNumber(contract.m[0]) & 1) : 0
              if (contract.c == 3 && renew && parseInt(broca.split(',')[0]) > 100) {
                extend({
                  broca: parseInt(broca.split(',')[0]) > parseInt(3 * contract.r / contract.p) ? parseInt(3 * contract.r / contract.p) + 1 : parseInt(parseInt(broca.split(',')[0]) / 2) + 1,
                  id: contract.i,
                  file_owner: contract.t,
                  block_num: num,
                  transaction_id: `v_op_${contract.t}_autoExtend_${contract.i}`
                }, contract.t, true, [resolve, reject, 0], context)
              } else {
                if (contract.df) {
                  var items = Object.keys(contract.df)//goods
                  for (var i = 0; i < items.length; i++) {
                    bytes += contract.df[items[i]]
                    ops.push({ type: "del", path: ['IPFS', items[i].split("").reverse().join("")] });
                  }
                  stats.total_bytes -= bytes
                  stats.total_files -= items.length
                }
                ops.push({
                  type: "put",
                  path: ["stats"],
                  data: stats
                });
                ops.push({ type: "del", path: ['contract', b.fo, b.id] });
                ops.push({ type: "del", path: ['cPointers', b.id] });
                ops.push({
                  type: "put",
                  path: ["feed", `${num}:vop_${id}`],
                  data: `${contract.i} expired`,
                });
                ops.push({ type: "del", path: ["chrono", delkey] });
                store.batch(ops, [resolve, reject]);
              }
            })
            .catch((e) => {
              console.log(e);
            });
        });
      }
      let Pproffer = getPathObj(['proffer', b.to, b.from, b.c]),
        Ptemplate = getPathObj(["template", b.c]),
        Pstats = getPathObj(["stats"]),
        Pbroca = getPathObj(["broca", b.from]),
        Ppow = getPathObj(["bpow", b.from]);
      contractClose(
        [Pproffer, Ptemplate, Pstats, Pbroca, Ppow],
        passed.delKey,
        num,
        passed.delKey.split(":")[1],
        b
      ).then((x) => res(x));
    }
  },
  {
    op: 'channel_check',
    func: function (b, passed, res, rej, num, prand, ints, context) {
      const { store, getPathObj, Base64 } = context;
      const broca_calc = (last = '0,0', pow, stats, bn, add = 0) => {
        if (typeof last != "string") last = '0,0'
        const last_calc = Base64.toNumber(last.split(',')[1])
        const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc)) / (pow * (stats.broca_daily_trend > 1000 ? stats.broca_daily_trend : 1000))) //revisit 
        var total = parseInt(last.split(',')[0]) + accured + add
        if (total > (pow * 1000)) total = (pow * 1000)
        return `${total},${Base64.fromNumber(bn)}`
      }
      function contractClose(promies, delkey, num, id, b) {
        return new Promise((resolve, reject) => {
          Promise.all(promies)
            .then((mem) => {
              let contract = mem[0],
                template = mem[1],
                stats = mem[2],
                broca = mem[3],
                bpow = mem[4],
                ops = [];
              if (contract.c == b.e) {
                var bytes = 0, items = []
                if (contract.df) items = Object.keys(contract.df)//goods
                for (var i = 0; i < items.length; i++) {
                  bytes += contract.df[items[i]]
                  ops.push({ type: "del", path: ['IPFS', items[i].split("").reverse().join("")] });
                }
                stats.total_bytes -= bytes
                stats.total_files -= items.length
                ops.push({
                  type: "put",
                  path: ["stats"],
                  data: stats
                });
                if (contract?.s) ops.push({ type: "del", path: ['ben', b.to, contract?.s.split(',')[0]] });
                ops.push({ type: "del", path: ['proffer', b.to, b.from, b.c] });
                ops.push({ type: "del", path: ['partial_update', b.c.split(":")[2]] });
                ops.push({ type: "del", path: ['contract', b.to, contract.i] });
                if (contract.s) ops.push({ type: "del", path: ['ben', b.to, contract.s.split(',')[0]] });
                ops.push({
                  type: "put",
                  path: ["feed", `${num}:vop_${id}`],
                  data: `${contract.i} canceled. ${contract.r} BROCA returned to ${contract.f}`,
                });
                ops.push({ type: "del", path: ['cPointers', contract.i] });
                ops.push({
                  type: "put",
                  path: ["broca", b.from],
                  data: broca_calc(broca, bpow, stats, num, contract.r)
                });
              }
              ops.push({ type: "del", path: ["chrono", delkey] });
              store.batch(ops, [resolve, reject]);
            })
            .catch((e) => {
              console.log(e);
            });
        });
      }
      let Pcontract = getPathObj(['contract', b.fo, b.id]),
        Pstatss = getPathObj(["stats"]),
        Pbrocaa = getPathObj(["broca", b.fo]),
        Ppowa = getPathObj(["spow", b.fo]);
      contractClose(
        [Pproffer, Ptemplate, Pstats, Pbroca, Ppow],
        passed.delKey,
        num,
        passed.delKey.split(":")[1],
        b
      ).then((x) => res(x));
    }
  },
]

const featuresModel = {
  rewards: {
    id: 'claim',
    msg: 'Claiming LARYNX rewards',
    auth: 'posting',
    type: "move",
    string: 'Reward ',
    B: true,
    json: {
      gov: {
        type: "B",
        string: "Lock to Governance",
        req: false
      }
    },
  },
  send: {
    id: 'send',
    string: 'Send',
    B: true,
    msg: 'Sending LARYNX',
    auth: 'active',
    type: "move",
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
      to: {
        type: "S",
        string: "To",
        req: true,
        check: "AC"
      },
      memo: {
        type: "S",
        string: "Memo",
        req: false
      }
    },
  },
  powup: {
    id: 'power_up',
    string: 'Power Up',
    B: true,
    msg: 'Powering LARYNX',
    auth: 'active',
    type: "move",
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
    }
  },
  powdn: {
    id: 'power_down',
    msg: 'Powering Down LARYNX',
    auth: 'active',
    type: "move",
    string: 'Power Down',
    B: true,
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
    },
  },
  powdel: {
    id: "power_grant",
    msg: 'Granting LARYNX',
    auth: 'active',
    type: "move",
    string: "Grant",
    B: true,
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
      to: {
        type: "S",
        string: "To",
        req: true,
        check: "AC" //account check
      },
    },
  },
  node: {
    id: 'node_add',
    opts: [{
      S: 'Domain',
      type: 'text',
      info: 'https://no-trailing-slash.com',
      json: 'domain',
      val: ''
    },
    {
      S: 'DEX Fee Vote',
      type: 'number',
      info: '500 = .5%',
      max: 1000,
      min: 0,
      json: 'bidRate',
      val: ''
    },
    {
      S: 'DEX Max Vote',
      type: 'number',
      info: '10000 = 100%',
      max: 10000,
      min: 0,
      json: 'dm',
      val: ''
    },
    {
      S: 'DEX Slope Vote',
      type: 'number',
      info: '10000 = 100%',
      max: 10000,
      min: 0,
      json: 'ds',
      val: ''
    }
    ],
  }
}
const featuresModelSpk = {
  rewards: {
    id: 'claim',
    msg: 'Claiming SPK rewards',
    auth: 'posting',
    type: "move",
    string: 'Reward ',
    B: true,
    json: {
      gov: {
        type: "B",
        string: "Lock to Governance",
        req: false
      }
    },
  },
  send: {
    id: 'send',
    string: 'Send',
    B: true,
    msg: 'Sending SPK',
    auth: 'active',
    type: "move",
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
      to: {
        type: "S",
        string: "To",
        req: true,
        check: "AC"
      },
      memo: {
        type: "S",
        string: "Memo",
        req: false
      }
    },
  },
  powup: {
    id: 'power_up',
    string: 'Power Up',
    B: true,
    msg: 'Powering SPK',
    auth: 'active',
    type: "move",
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
    }
  },
  powdn: {
    id: 'power_down',
    msg: 'Powering Down SPK',
    auth: 'active',
    type: "move",
    string: 'Power Down',
    B: true,
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
    },
  },
}
const featuresModelBroca = {
  rewards: {
    id: 'claim',
    msg: 'Claiming BROCA rewards',
    auth: 'posting',
    type: "move",
    string: 'Reward ',
    B: true,
    json: {
      gov: {
        type: "B",
        string: "Lock to Governance",
        req: false
      }
    },
  },
  send: {
    id: 'send',
    string: 'Send',
    B: true,
    msg: 'Sending BROCA',
    auth: 'active',
    type: "move",
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
      to: {
        type: "S",
        string: "To",
        req: true,
        check: "AC"
      },
      memo: {
        type: "S",
        string: "Memo",
        req: false
      }
    },
  },
  powup: {
    id: 'power_up',
    string: 'Power Up',
    B: true,
    msg: 'Powering BROCA',
    auth: 'active',
    type: "move",
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
    }
  },
  powdn: {
    id: 'power_down',
    msg: 'Powering Down BROCA',
    auth: 'active',
    type: "move",
    string: 'Power Down',
    B: true,
    json: {
      amount: {
        type: "I",
        string: "Amount",
        req: true
      },
    },
  },
}


//Aditionally on your branch, look closely at dao, this is where tokenomics happen and custom status posts are made

export var config = {
  username,
  active,
  msowner,
  mspublic,
  memoKey,
  timeoutContinuous,
  timeoutStart,
  follow,
  NODEDOMAIN,
  hookurl,
  status,
  history,
  dbcs,
  dbmods,
  typeDefs,
  mirror,
  bidRate,
  engineCrank,
  port,
  pintoken,
  pinurl,
  clientURL,
  startURL,
  clients,
  acm,
  rta,
  rtp,
  override,
  ipfshost,
  ipfsprotocol,
  ipfsport,
  ipfsLinks,
  starting_block,
  prefix,
  leader,
  msaccount,
  msPubMemo,
  msPriMemo,
  msmeta,
  ben,
  adverts,
  delegation,
  delegationWeight,
  TOKEN,
  precision,
  tag,
  mainAPI,
  jsonTokenName,
  mainFE,
  mainRender,
  mainIPFS,
  mainICO,
  detail,
  footer,
  hive_service_fee,
  features,
  stream,
  mode,
  featuresModel,
  CustomJsonProcessing,
  CustomOperationsProcessing,
  CustomAPI,
  CustomChron,
  featuresModelSpk,
  featuresModelBroca,
  poav_address,
  state
};