const config = require('./config');
module.exports = {
    "balances": {
        [config.leader]: 0,
        "spk-cc": 0, //additional distributions
        "ra": 0,
        "rb": 0,
        "rc": 0,
        "rd": 0,
        "re": 0,
        "ri": 0, //in ICO account for fixed price
        "rm": 0,
        "rn": 0,
        "rr": 0
    },
    "delegations": {}, //these need to be preloaded if already on account before starting block
    "dex": {
        "hbd": {
            "tick": "0.012500", //ICO price
            "buyBook": ""
        },
        "hive": {
            "tick": "0.100000", //ICO Price
            "buyBook": ""
        }
    },
    "gov": {
        [config.leader]: 1,
        "t": 1 //total in other accounts
    },
    "markets": {
        "node": {
            [config.leader]: {
                "attempts": 0,
                "bidRate": 2000,
                "contracts": 0,
                "domain": config.mainAPI,
                "escrow": true,
                "escrows": 0,
                "lastGood": 49994100, //genesisblock
                "marketingRate": 0,
                "mskey": "STM6EUEaEywYoxpeVDX1fPDxrsyQLGTsgYf1LLDSHWwiKBdgRhGrx",
                "self": config.leader,
                "wins": 0,
                "yays": 0
            }
        }
    },
    "queue": {
        "0": [config.leader]
    },
    "runners": {
        [config.leader]: { //config.leader
            "g": 1, //config.mainAPI
        }
    },
    "stats": {
        "IPFSRate": 2000,
        "budgetRate": 2000,
        "currationRate": 2000,
        "delegationRate": 2000,
        "dex_fee": "0.005",
        "hashLastIBlock": "Genesis",
        "icoPrice": 0, //in millihive
        "interestRate": 999999999999, //mints 1 millitoken per this many millitokens in your DAO period
        "lastBlock": "",
        "movingWeight": 0,
        "marketingRate": 2500,
        "maxBudget": 1000000000,
        "ms": {
            "account": "spk-cc",
            "active_account_auths": {
                "regardspk": 1,
            },
            "active_threshold": 1,
            "memo_key": "STM5se9o2oZwY7ztpo2scyvf12RR41zaYa6rozBtetwfr1DmH1J5k",
            "owner_key_auths": {
                "STM6EUEaEywYoxpeVDX1fPDxrsyQLGTsgYf1LLDSHWwiKBdgRhGrx": 1,
            },
            "owner_threshold": 1,
            "posting_account_auths": {
                "regardspk": 1
            },
            "posting_threshold": 1
        },
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