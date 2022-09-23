require('dotenv').config();
const ENV = process.env;

const username = ENV.account || 'regardspk';
const active = ENV.active || '';
const follow = ENV.follow || 'regardspk';
const msowner = ENV.msowner || '';
const mspublic = ENV.mspublic || '';
const memoKey = ENV.memo || '';
const hookurl = ENV.discordwebhook || '';
const NODEDOMAIN = ENV.domain || '' //where your API lives
const acm = ENV.account_creator || false //account creation market ... use your accounts HP to claim account tokens
const mirror = ENV.mirror || false //makes identical posts, votes and IPFS pins as the leader account
const port = ENV.PORT || 3001;
const pintoken = ENV.pintoken || ''
const pinurl = ENV.pinurl || '';
const status = ENV.status || true
const dbcs = ENV.DATABASE_URL || '';
const snapcs = ENV.SNAPBASE_URL || "http://65.108.66.120:8002"; // get a public facing snapshot server
const history = ENV.history || 3600
const stream = ENV.stream || 'irreversible'
const mode = ENV.mode || 'normal'
const timeoutStart = ENV.timeoutStart || 180000
const timeoutContinuous = ENV.timeoutContinuous || 30000


// testing configs for replays
const override = ENV.override || 0 //69116600 //will use standard restarts after this blocknumber
const engineCrank =
  ENV.startingHash || "QmWh6F8DKyDjRxkvgrh89Ssjh9zoNtm8UYS3CztppiWFHj"; //but this state will be inserted before

// third party configs
const rta = ENV.rta || '' //rtrades account : IPFS pinning interface
const rtp = ENV.rtp || '' //rtrades password : IPFS pinning interface

const ipfshost = ENV.ipfshost || "infura-ipfs.io"; //IPFS upload/download provider provider
const ipfsport = ENV.ipfsport || '5001' //IPFS upload/download provider provider

const ipfsLinks = ENV.ipfsLinks
  ? ENV.ipfsLinks.split(" ")
  : [
      "https://ipfs:8080/ipfs/",
      "http://localhost:8080/ipfs/",
      "https://ipfs.3speak.tv/ipfs/",
      "https://infura-ipfs.io/ipfs/",
      "https://ipfs.alloyxuast.co.uk/ipfs/",
      "https://ipfs1.alloyxuast.tk/ipfs/"
    ];

const ipfsprotocol = ENV.ipfsprotocol || 'https' //IPFS upload/download protocol
//node market config > 2500 is 25% inflation to node operators, this is currently not used
const bidRate = ENV.BIDRATE || 500 // your vote for the dex fee 500 = 0.500% Max 1000

//HIVE CONFIGS
var startURL = ENV.STARTURL || "https://api.hive.blog/";
var clientURL = ENV.APIURL || "https://api.hive.blog/";
const clients = ENV.clients ? ENV.clients.split(" ") : [
  "https://api.deathwing.me/",
  //"https://api.c0ff33a.uk/",
  "https://rpc.ecency.com/",
  "https://hived.emre.sh/",
  //"https://rpc.ausbit.dev/",
  "https://api.hive.blog/",

];

//!!!!!!! -- THESE ARE COMMUNITY CONSTANTS -- !!!!!!!!!//
//TOKEN CONFIGS -- ALL COMMUNITY RUNNERS NEED THESE SAME VALUES
const starting_block = 62313601; //from what block does your token start
const prefix = 'spkcc_' //Community token name for Custom Json IDs
const TOKEN = 'LARYNX' //Token name
const precision = 3 //precision of token
const tag = 'spk' //the fe.com/<tag>/@<leader>/<permlink>
const jsonTokenName = 'larynx' //what customJSON in Escrows and sends is looking for
const leader = 'regardspk' //Default account to pull state from, will post token
const ben = '' //Account where comment benifits trigger token action
const delegation = '' //account people can delegate to for rewards
const delegationWeight = 1000 //when to trigger community rewards with bens
const msaccount = 'spk-cc' //account controlled by community leaders
const msPubMemo = 'STM5GNM3jpjWh7Msts5Z37eM9UPfGwTMU7Ksats3RdKeRaP5SveR9'
const msPriMemo = '5KDZ9fzihXJbiLqUCMU2Z2xU8VKb9hCggyRPZP37aprD2kVKiuL'
const msmeta = ''
const mainAPI = 'spktoken.dlux.io' //leaders API probably
const mainRender = '' //data and render server
const mainFE = '3speak.tv' //frontend for content
const mainIPFS = 'ipfs.3speak.tv' //IPFS service
const mainICO = '' //Account collecting ICO HIVE
const footer = ''//`\n[Find us on Discord](https://discord.gg/Beeb38j)`
const hive_service_fee = 100 //HIVE service fee for transactions in Hive/HBD in centipercents (1% = 100)
const features = {
    pob: false, //proof of brain
    delegate: false, //delegation
    daily: true,
    liquidity: false, //liquidity
    ico: false, //ico
    dex: true, //dex
    nft: false, //nfts
    state: true, //api dumps
    claimdrop: true, //claim drops
    inflation: false //inflation
}
const featuresModel = {
            claim_id: 'claim',
            claim_S: 'Airdrop',
            claim_B: true,
            claim_json: 'drop',
            rewards_id: 'shares_claim',
            rewards_S: 'Rewards',
            rewards_B: true,
            rewards_json: 'claim',
            rewardSel: false,
            reward2Gov: false,
            send_id: 'send',
            send_S: 'Send',
            send_B: true,
            send_json: 'send',
            powup_id: 'power_up',
            powup_B: false,
            pow_val: '',
            powdn_id: 'power_down',
            powdn_B: false,
            powsel_up: false,
            govup_id: 'gov_up',
            govup_B: true,
            gov_val: '',
            govsel_up: true,
            govdn_id: 'gov_down',
            govdn_B: true,
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
                },
                {
                  S: 'DAO Claim Vote',
                  type: 'number',
                  info: '1500 = 15%',
                  max: 10000,
                  min: 0,
                  json: 'dv',
                  val: ''
                }
              ],
            }
          }
const adverts = [
    'https://camo.githubusercontent.com/954558e3ca2d68e0034cae13663d9807dcce3fcf/68747470733a2f2f697066732e627573792e6f72672f697066732f516d64354b78395548366a666e5a6748724a583339744172474e6b514253376359465032357a3467467132576f50'
]
const detail = {
                name: 'Larynx Miner Token',
                symbol: 'LARYNX',
                icon: 'https://www.dlux.io/img/dlux-hive-logo-alpha.svg',
                supply:'Hive 1:1 Airdrop',
                wp:`https://docs.google.com/document/d/1_jHIJsX0BRa5ujX0s-CQg3UoQC2CBW4wooP2lSSh3n0/edit?usp=sharing`,
                ws:`https://www.dlux.io`,
                be:`https://hiveblockexplorer.com/`,
                text: `Larynx is a token that is used to mine SPK.`
            }

//Aditionally on your branch, look closely at dao, this is where tokenomics happen and custom status posts are made

let config = {
    username,
    active,
    msowner,
    mspublic,
    memoKey,
    follow,
    NODEDOMAIN,
    hookurl,
    status,
    history,
    dbcs,
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
    snapcs,
    stream,
    mode,
    featuresModel,
    timeoutStart,
    timeoutContinuous,
};

module.exports = config;
