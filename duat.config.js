require("dotenv").Config();
const { getPathObj, getPathNum } = require("./getPathObj")
const { store } = require("./index");
const { chronAssign } = require("./lil_ops")

const ENV = process.env;

const username = ENV.account || "disregardfiat";
const active = ENV.active || "";
const follow = ENV.follow || "disregardfiat";
const msowner = ENV.msowner || "";
const mspublic = ENV.mspublic || "";
const memoKey = ENV.memo || "";
const hookurl = ENV.discordwebhook || "";
const NODEDOMAIN = ENV.domain || "http://dlux-token.herokuapp.com" //where your API lives
const acm = ENV.account_creator || false //account creation market ... use your accounts HP to claim account tokens
const mirror = ENV.mirror || false //makes identical posts, votes and IPFS pins as the leader account
const port = ENV.PORT || 3001;
const pintoken = ENV.pintoken || ""
const pinurl = ENV.pinurl || "";
const status = ENV.status || true
const dbcs = ENV.DATABASE_URL || "";
const dbmods = ENV.DATABASE_MODS || []; //list of moderators to hide posts in above db
const typeDefs = ENV.APPTYPES || {
  ["360"]: ["QmNby3SMAAa9hBVHvdkKvvTqs7ssK4nYa2jBdZkxqmRc16"],
}
const history = ENV.history || 3600
const stream = ENV.stream || "irreversible"
const mode = ENV.mode || "normal"
const timeoutStart = ENV.timeoutStart || 180000;
const timeoutContinuous = ENV.timeoutContinuous || 30000;

// testing configs for replays
const override = ENV.override || 0 //69116600 //will use standard restarts after this blocknumber
const engineCrank = ENV.startingHash || "QmconUD3faVGbgC2jAXRiueEuLarjfaUiDz5SA74kptuvu" //but this state will be inserted before

const ipfshost = ENV.ipfshost || "127.0.0.1" //IPFS upload/download provider provider
const ipfsport = ENV.ipfsport || "5001" //IPFS upload/download provider provider
const ipfsprotocol = ENV.ipfsprotocol || "http" //IPFS upload/download protocol
var ipfsLinks = ENV.ipfsLinks
  ? ENV.ipfsLinks.split(" ")
  : [
      `${ipfsprotocol}://${ipfshost}:${ipfsport}/ipfs/`,
      "https://ipfs.dlux.io/ipfs/",
      "https://ipfs.3speak.tv/ipfs/",
      "https://infura-ipfs.io/ipfs/",
      "https://ipfs.alloyxuast.co.uk/ipfs/",
    ];

//node market config > 2500 is 25% inflation to node operators, this is currently not used
const bidRate = ENV.BIDRATE || 2500 //

//HIVE CONFIGS
var startURL = ENV.STARTURL || "https://hive-api.dlux.io/";
var clientURL = ENV.APIURL || "https://hive-api.dlux.io/";
const clients = ENV.clients
  ? ENV.clients.split(" ")
  : [
      "https://api.deathwing.me/",
      "https://hive-api.dlux.io/",
      "https://rpc.ecency.com/",
      "https://hived.emre.sh/",
      "https://rpc.ausbit.dev/",
      "https://api.hive.blog/",
    ];

//!!!!!!! -- THESE ARE COMMUNITY CONSTANTS -- !!!!!!!!!//
//TOKEN CONFIGS -- ALL COMMUNITY RUNNERS NEED THESE SAME VALUES
const starting_block = 63654900; //from what block does your token start
const prefix = "duat_" //Community token name for Custom Json IDs
const TOKEN = "DUAT" //Token name
const precision = 3 //precision of token
const tag = "ragnarok" //the fe.com/<tag>/@<leader>/<permlink>
const jsonTokenName = "duat" //what customJSON in Escrows and sends is looking for
const leader = "inconceivable" //Default account to pull state from, will post token 
const ben = "" //Account where comment benifits trigger token action
const delegation = "" //account people can delegate to for rewards
const delegationWeight = 1000 //when to trigger community rewards with bens
const msaccount = "ragnarok-cc" //account controlled by community leaders
const msPubMemo = "STM5GNM3jpjWh7Msts5Z37eM9UPfGwTMU7Ksats3RdKeRaP5SveR9" //memo key for msaccount
const msPriMemo = "5KDZ9fzihXJbiLqUCMU2Z2xU8VKb9hCggyRPZP37aprD2kVKiuL"
const msmeta = ""
const mainAPI = "duat.hivehoneycomb.com" //leaders API probably
const mainRender = "duatdata.hivehoneycomb.com" //data and render server
const mainFE = "ragnarok.com" //frontend for content
const mainIPFS = "a.ipfs.dlux.io" //IPFS service
const mainICO = "" //Account collecting ICO HIVE
const footer = "\n[Find us on Discord](https://bit.ly/discordragnarok)";
const hive_service_fee = 100 //HIVE service fee for transactions in Hive/HBD in centipercents (1% = 100)
const features = {
    pob: false, //proof of brain
    delegate: false, //delegation
    daily: false, // daily post
    liquidity: false, //liquidity
    ico: false, //ico
    inflation: false,
    dex: true, //dex
    nft: true, //nfts
    state: true, //api dumps
    claimdrop: true //claim drops
}

const CustomJsonProcessing = []
const CustomOperationsProcessing = []
const CustomAPI = []
const CustomChron = []
const stateStart = {
  "balances": {
      [leader]: 0,
      "ra": 0,
      "rb": 0,
      "rc": 0,
      "rd": 0,
      "re": 0,
      "ri": 0,
      "rm": 0,
      "rn": 0,
      "rr": 0
  },
  "delegations": {},
  "dex": {
      "hbd": {
          "tick": "0.012500",
          "buyBook": ""
      },
      "hive": {
          "tick": "0.100000",
          "buyBook": ""
      }
  },
  "gov": {
      [leader]: 1,
      "t": 1 //total in other accounts
  },
  "markets": {
      "node": {
          [leader]: {
              "attempts": 0,
              "bidRate": 2000,
              "contracts": 0,
              "domain": mainAPI,
              "escrow": true,
              "escrows": 0,
              "lastGood": 49994100, //genesisblock
              "marketingRate": 0,
              "self": [leader],
              "wins": 0,
              "yays": 0
          }
      }
  },
  "pow": {
      [leader]: 0,
      "t": 0 //total in other accounts
  },
  "queue": {
      "0": [leader]
  },
  "runners": {
      [leader]: { //config.leader
          "g": 1, //config.mainAPI
      }
  },
  "stats": {
      "IPFSRate": 2000,
      "budgetRate": 2000,
      "currationRate": 2000,
      "delegationRate": 2000,
      "hashLastIBlock": "Genesis",
      "icoPrice": 0, //in millihive
      "interestRate": 999999999999, //mints 1 millitoken per this many millitokens in your DAO period
      "lastBlock": "",
      "marketingRate": 2500,
      "maxBudget": 1000000000,
      "MSHeld":{
          "HIVE": 0,
          "HBD": 0
      }, 
      "nodeRate": 2000,
      "outOnBlock": 0, //amm ICO pricing
      "savingsRate": 1000,
      "tokenSupply": 1 //your starting token supply
  }
}

const featuresModel = {
  claim_id: "drop_claim",
  claim_S: "Airdrop",
  claim_B: false,
  claim_json: "drop_claim",
  rewards_id: "claim",
  rewards_S: "Rewards",
  rewards_B: true,
  rewards_json: "claim",
  rewardSel: false,
  reward2Gov: true,
  send_id: "send",
  send_S: "Send",
  send_B: true,
  send_json: "send",
  powup_id: "power_up",
  powup_B: false,
  pow_val: "",
  powdn_id: "power_down",
  powdn_B: false,
  powsel_up: false,
  govup_id: "gov_up",
  govup_B: true,
  gov_val: "",
  govsel_up: true,
  govdn_id: "gov_down",
  govdn_B: true,
  node: {
    id: "node_add",
    enabled: true,
    opts: [
      {
        S: "Domain",
        type: "text",
        info: "https://no-trailing-slash.com",
        json: "domain",
        val: "",
      },
      {
        S: "DEX Fee Vote",
        type: "number",
        info: "500 = .5%",
        max: 1000,
        min: 0,
        json: "bidRate",
        val: "",
      },
      {
        S: "DEX Max Vote",
        type: "number",
        info: "10000 = 100%",
        max: 10000,
        min: 0,
        json: "dm",
        val: "",
      },
      {
        S: "DEX Slope Vote",
        type: "number",
        info: "10000 = 100%",
        max: 10000,
        min: 0,
        json: "ds",
        val: "",
      },
    ],
  },
  nft: [
    {
      id: "ft_sell",
      enabled: true,
      props: [
        {
          name: "set",
          type: "string",
          help: "Set the FT to buy",
        },
        {
          name: "uid",
          type: "string",
          help: "UID of the FT to buy",
        },
        {
          name: "bid_amount",
          type: "number",
          help: `milli${TOKEN}`,
        },
      ],
    },
    {
      id: "ft_buy",
      enabled: true,
      props: [
        {
          name: "set",
          type: "string",
          help: "Set the FT to buy",
        },
        {
          name: "uid",
          type: "string",
          help: "UID of the FT to buy",
        },
      ],
    },
    {
      id: "nft_sell_cancel",
      enabled: true,
      props: [
        {
          name: "set",
          type: "string",
          help: "Set the FT to cancel sell",
        },
        {
          name: "uid",
          type: "string",
          help: "UID of the FT to cancel sell",
        },
      ],
    },
    {
      id: "ft_sell_cancel",
      enabled: true,
      props: [
        {
          name: "set",
          type: "string",
          help: "Set the FT to cancel sell",
        },
        {
          name: "uid",
          type: "string",
          help: "UID of the FT to cancel sell",
        },
      ],
    },
    {
      id: "ft_auction",
      enabled: true,
      props: [
        {
          name: "set",
          type: "string",
          help: "Set the NFT to be auctioned",
        },
        {
          name: "uid",
          type: "string",
          help: "UID of the NFT to be auctioned",
        },
        {
          name: "price",
          type: "number",
          help: "milliTYPE",
        },
        {
          name: "type",
          type: "string",
          help: "HIVE or HBD",
        },
        {
          name: "time",
          type: "number",
          help: "Number of Days, 7 Max.",
        },
      ],
    },
    {
      id: "ft_bid",
      enabled: true,
      props: [
        {
          name: "set",
          type: "string",
          help: "Set the NFT to be bid on",
        },
        {
          name: "uid",
          type: "string",
          help: "UID of the NFT to be bid on",
        },
        {
          name: "bid_amount",
          type: "number",
          help: `milli${TOKEN}`,
        },
      ],
    },
    {
      id: "nft_hauction",
      enabled: false,
      props: [
        {
          name: "set",
          type: "string",
          help: "Set the NFT to be auctioned",
        },
        {
          name: "uid",
          type: "string",
          help: "UID of the NFT to be auctioned",
        },
        {
          name: "price",
          type: "number",
          help: "milliTYPE",
        },
        {
          name: "type",
          type: "string",
          help: "HIVE or HBD",
        },
        {
          name: "time",
          type: "number",
          help: "Number of Days, 7 Max.",
        },
      ],
    },
    {
      id: "fth_buy",
      enabled: true,
      props: [
        {
          name: "amount",
          type: "number",
          help: `milli${TOKEN}`,
        },
        {
          name: "qty",
          type: "number",
          help: "Purchase Quantity",
        },
        {
          name: "set",
          type: "string",
          help: "Set Name",
        },
        {
          name: "item",
          type: "string",
          help: "contract name",
        },
      ],
    },
  ]
}
const adverts = [
    "https://camo.githubusercontent.com/954558e3ca2d68e0034cae13663d9807dcce3fcf/68747470733a2f2f697066732e627573792e6f72672f697066732f516d64354b78395548366a666e5a6748724a583339744172474e6b514253376359465032357a3467467132576f50"
]     //adverts for community
const detail = {
                name: "DUAT NFT Platform",
                symbol: TOKEN,
                icon: "https://www.dlux.io/img/dlux-hive-logo-alpha.svg",
                supply:"Claim Only",
                wp:"https://docs.google.com/document/d/1_jHIJsX0BRa5ujX0s-CQg3UoQC2CBW4wooP2lSSh3n0/edit?usp=sharing",
                ws:"https://www.dlux.io",
                be:"https://hiveblockexplorer.com/",
                text: "DUAT is a NFT platform that allows users to claim and send NFTs to other users."
            }

//Aditionally on your branch, look closely at dao, this is where tokenomics happen and custom status posts are made

let config = {
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
    stateStart
};

module.exports = config;
