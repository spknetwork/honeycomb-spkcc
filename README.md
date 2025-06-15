# HoneyComb

This is a Decentralized Autonomous Organization built on the HIVE ecosystem. Customize it as you need

Powering: dlux.io (DLUX), and the 3speak.tv (SPK Claim Chain)

This software builds a network of peers that use HIVE to post and interpret transactions. This allows these peers to come to a consensus and elect peers to run tasks. Distributing computing in this way allows a vast amount of potential applications, DeFi, and oracle services. By distributing authority to perform transactions we can have a frictionless(no intermediate tokens, no central authority, no intrinsic fees) way to cross asset boundaries(HIVE/COMB) with no information asymmetries, ie Finance without securities by definition... just free speech: As no party is required to perfom any function, or prevented from performing any function, no promises are made by peers. Network Incentives (COMB) alone are enough to maintain trust.

* Send: Use custom_json with active permission, "ACJ" to send OPEN_TOEK tokens
* Illiquid voting state. Power up and down TOKEN for voting and delegation with ACJ
* Illiquid governance token for determining consensus and collateral.
* Chron to execute virtual operations: expire trades, powerdown stake, enforce penalties etc...
* Hive posts that benefit the configured account at > the configured % are: 
   * entered into a voting eligible content pool
   * optionally have their IPFS content pinned with rtrades(3rd party service)
   * can be programmed for any other function
* Users can vote on content with weight, using custom json with posting permissions.
* Have a daily pool of 10 full votes, and 1 in 10000 fine control of voting stake.
* State is saved to IPFS every 5 minutes for fast automatic starts and restarts, also used to determine consensus
* LevelDB with custom transactional handlers for transactional writes
* JSON express server API
* Token sales from the configured account with HIVE transfers
* Token sales set with pricing feedback.
* 2/3rds consensus algorithm
* automatic messaging to join network ad-hoc
* ability to delete node from list(turn off escrow queue)
* report consensus
* distribute TOKENS to configured account delegators and keep running total
   * Used for auto voting on content with delegation
* pay nodes for processing trusted state, facilitating an escrow/dex transaction or running a smart contract.
   * Effectively mining TOKENS with Hive Resource Credits
* establishes a 5%(configurable) inflation rate and distributes rewards to run the network
* Automated accounting post from configured account or mirrors
* Track interactions on a rolling feed via block_num and TXID.
* Automates IPFS pinning for OPEN_TOKEN votable content from configured account or mirrors
* 2 way DEX
  * HIVE:OPEN_TOKEN & HBD:OPEN_TOKEN pairs
  * On state trade history with daily reductions to high/low/volume
  * Price/collateral controls from Volume Weighted Moving Average
  * Enforcement of collateral
* Partial fills of DEX orders `1.0.0`
* Multi-signature deterministic control of community capital
* NFT/smart contract system

***

This software is meant to be run as a public API for decentralized token data.

While it runs it verifies other nodes are operating correctly and confirms this by posting a customJson transaction to Hive. 288(configurable) messages will be required per day per node operator. More Resource Credits will be required to handle escrow transactions and transfers.

Deploy from heroku or similar and set ENV variables with a hive name and active key. Deploy from home computer for maximum account security.

* `account` - dlux-io
* `active` - active posting key (will run escrow transactions for rewards) !! *caution while in testing* !!
* `domain` - `https://<token-api>.<a-domain>.com` or `http://<static-ip>:<port>`

***


***

### Running A Node

### Prerequisites

* This software has been tested on Node.js version 10 through 15
* Node.js and git are required

### Server Installation
Detailed Instructions also at /docs/setup.md
Which include Docker and IPFS linking

* Clone this repository

`git clone https://github.com/disregardfiat/honeycomb.git`

* Navigate to the root directory of token

`cd honeycomb`

* Set configuration variables
Choose a community and install it's config file
`cp <token>.config.js config.js`
Then set your specifics
`nano .env` or your favorite editor

`account=hiveaccount
active=hiveactivekey`

* Quit editor and save changes

* Install

`npm install`

* Start

`npm start`

### Recommendations

* Script a way to automatically git pull to stay up to date with daily changes.
* Setup a system service to restart on quits to keep your node online.

### Cloud Installation

* Choose a cloud provider
* Fork this repository
* Connect your fork to the cloud server
* Set configuration variables

`account=hiveaccount`

`active=hiveactivekey`

***

### To Build Your Own Token

Branch this and find this part of `config.js`

*TOKEN CONFIGS -- ALL COMMUNITY RUNNERS NEED THESE SAME VALUES*

`const starting_block = 49988008;` //from what block does your token start

`const prefix = 'dlux_'` //Community token name for Custom Json IDs

`const TOKEN = 'DLUX'` //Token name

`const tag = 'dlux'` //https://the-front-end.com/`tag`/@`leader`/`permlink`

`const jsonTokenName = 'dlux'` //what customJSON in Escrows and sends is looking for

`const leader = 'dlux-io'` //Default account to pull state from, will post daily

`const ben = 'dlux-io'` //Account where comment benifits trigger token action

`const delegation = 'dlux-io'` //account people can delegate to for rewards

`const msaccount = 'dac.escrow'` //account controlled by community leaders

`const mainAPI = 'token.dlux.io'` //leaders API probably

`const mainFE = 'dlux.io'` //frontend for content

`const mainIPFS = 'a.ipfs.dlux.io'` //IPFS service

`const mainICO = 'robotolux'` //Account collecting ICO HIVE

Then alter the `state.js` with balances and other starting information

---

# Fungible Token and Non-Fungible Token (NFT) Operations 

DLUX offers a decentralized protocol for minting and trading NFT's. These tokens can be minted, auctioned, transferred, sold, bought, held in escrow, bid on, or deleted.

## NFT Types and Execution Context

The HoneyComb NFT system supports 4 different NFT types with varying capabilities:

### Type 1: Basic NFT
- Standard static NFT with no additional functionality  
- Script field contains an IPFS CID pointing to static content (HTML, SVG, image, etc.)
- State contains only `lastModified` timestamp
- Most common type for simple collectibles and artwork

### Type 2: Executable NFT  
- Includes executable code that can be updated by the NFT owner
- Has an `exe_size` limit defined during set creation
- Executable content is stored in the NFT's `s` (state) field as comma-separated values: `lastModified,executableCode`
- The executable code can be JavaScript or any other code that the rendering environment supports

### Type 3: Optional Content NFT
- Includes additional optional metadata that can be updated by the NFT owner  
- Has an `opt_size` limit defined during set creation
- Optional content is stored as: `lastModified,optionalContent`
- Useful for dynamic metadata, descriptions, or other mutable properties

### Type 4: Executable + Optional NFT
- Combines both executable and optional content capabilities
- Has both `exe_size` and `opt_size` limits
- State format: `lastModified,executableCode,optionalContent`
- Most flexible NFT type supporting both dynamic code and metadata

### Execution Context

When NFTs are rendered or executed:

1. **Script Field**: The main `script` field in the NFT set definition contains the base rendering code (often HTML/JavaScript)
2. **Executable Content**: For types 2 & 4, the executable content from the NFT's state can modify behavior, add interactivity, or change presentation
3. **Optional Content**: For types 3 & 4, provides dynamic metadata that can be displayed or used by the rendering script
4. **Security Model**: 
   - Code execution happens in the client/browser environment
   - No server-side execution or access to blockchain state
   - Sandboxed execution depending on implementation
   - Size limits prevent excessive content storage

### Use Cases

- **Type 2**: Interactive games, dynamic art, programmable behavior
- **Type 3**: NFTs with evolving descriptions, attributes that change over time  
- **Type 4**: Full dynamic NFTs like virtual pets, evolving artwork, or complex interactive experiences

The executable and optional content can only be modified by the current NFT owner using the `nft_update_exe` and `nft_update_opt` functions respectively.

# Actions Available

## NFT (non-fungible token) Actions

### NFT Set Profile Picture (id: dlux_nft_pfp)

This action sets an NFT as the user's profile picture.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT

#### example:
```json
{
    "set": "dlux",
    "uid": "aa"
}
```

### NFT Transfer (id: dlux_nft_transfer)

This action transfers an NFT from one wallet to another.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT to be transferred
* to = string representing the wallet to receive the transfer

#### example:

```json
{
    "set": "dlux",
    "uid": "aa",
    "to": "somebody"
}
```

### NFT Reserve Transfer (id: dlux_nft_reserve_transfer)

This action builds a token escrow contract with payment price and expiration. Seller uses this action to create a contract for specific wallet to pay for and receive the NFT. As opposed to listing it publicly on the market which would allow any buyer to buy the token.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT to be transferred
* to = string representing the wallet to receive the transfer
* price = integer representing price to complete the contract, with 3 precision
* type = string (optional) - 'HIVE', 'HBD', or defaults to 'TOKEN'

#### example:
```json
{
    "set": "dlux",
    "uid": "aa",
    "to": "somebody",
    "price": 1000,
    "type": "HIVE"
}
```

### NFT Reserve Complete (id: dlux_nft_reserve_complete)

This action fulfills an NFT escrow transfer via complete payment. Recipient of NFT uses this action to complete the contract and receive the NFT. If successful, the price defined in the contract will be deducted from the wallet. Currently only supports 'TOKEN' type payments.

#### params:
* set = string representing the name of the NFT set  
* uid = string representing the unique ID of the NFT to be transferred

#### example:
```json
{
    "set": "dlux",
    "uid": "aa"
}
```

### NFT Transfer Cancel (id: dlux_nft_transfer_cancel)

This action cancels an NFT transfer escrow contract by either the sender or recipient.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT to be transferred

#### example:
```json
{
    "set": "dlux",
    "uid": "AA"
}
```

### NFT Delete (id: dlux_nft_delete)

This action will permanently delete an NFT. Cannot be undone. Changes NFT's owner to 'D' and returns the bond value to the owner.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT to be deleted

#### example:
```json
{
    "set": "dlux",
    "uid": "AA"
}
```

### NFT Define (id: dlux_nft_define)

This action defines a new NFT set. Supports 4 different types with varying capabilities.

#### params:
* name = string - Name of the NFT set
* type = integer - NFT type (1: basic, 2: executable, 3: additional options, 4: executable + options)
* script = string - IPFS hash or inline HTML/script for NFT rendering
* permlink = string - Hive content permlink pointing to NFT set announcement post
* start = string - Base-64 encoded starting ID for minting range
* end = string - Base-64 encoded ending ID for minting range
* total = integer (optional) - Maximum number of NFTs to mint (cannot exceed range)
* royalty = integer - Royalty percentage (default: 0)
* handling = string - Content type ('svg', 'html', etc.)
* max_fee = integer - Maximum fee willing to pay for set creation
* bond = integer - Burn value preloaded into each NFT (default: 0)
* long_name = string (optional) - Extended name for the set
* exe_size = integer - Size limit for executable content (types 2,4)
* opt_size = integer - Size limit for optional content (types 3,4)

#### example:
```json
{
    "name": "dlux",
    "type": 1,
    "script": "QmPsxgySUZibuojuUWCMQJpT2uZhijY4Cf7tuJKR8gpZqq",
    "permlink": "disregardfiat/nft-announcement",
    "start": "00",
    "end": "==",
    "royalty": 100,
    "handling": "svg",
    "max_fee": 10000000,
    "bond": 1000
}
```

#### Original Script Example (Color-based SVG):
```html
<!DOCTYPE html>
//<html><head><script>
function compile (message, display) {
const colors = ['#000000', '#AA0000', '#00AA00', '#AA5500', '#0000AA', '#AA00AA', '#00AAAA', '#AAAAAA', '#555555', '#FF5555', '#55FF55', '#FFFF55', '#5555FF', '#FF55FF', '#55FFFF', '#FFFFFF']
const Base64 = {
    _Rixits :
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=",
    toFlags : function (rixits) {
        var result = []
        rixits = rixits.split('');
        for (j = 0; j < rixits.length; j++) {
            for (var i = 32; i >= 1; i = i/2){
                if (this._Rixits.indexOf(rixits[j]) >= i){
                    result.unshift(1)
                    rixits[j] = this._Rixits[this._Rixits.indexOf(rixits[j]) - i]
                } else {
                    result.unshift(0)
                }
            }
        }
        return result
    }
} 
        const flags = Base64.toFlags(message)
        var uColors = []
        var picker = 0
        for(var i = 0; i < 3; i++){
            for(var j = 0; j < 4; j++){
                if(flags[i*4 + j]){
                    picker += Math.pow(2,j)
                }
            }
            uColors.push(colors[picker])
            picker = 0
        }
        const SVG = '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 333 333"><defs><style>.cls-1{fill:#393d49;}.cls-2' + uColors[0].replace('#', '') + '{fill:' + uColors[0] + ';}.cls-3' + uColors[1].replace('#', '') + '{fill:' + uColors[1] + ';}.cls-4' + uColors[2].replace('#', '') + '{fill:' + uColors[2] + ';}</style></defs><rect class="cls-1" width="333" height="333" rx="33.3"/><polygon class="cls-2' + uColors[0].replace('#', '') + '" points="180.51 142.86 180.22 142.86 123.17 46.14 207.53 44.57 214.82 56.49 144.19 57.9 151.11 69.33 165.81 93.63 180.52 117.94 187.66 129.75 201.54 129.74 229.98 129.74 257.94 129.74 271.94 129.74 236.41 68.54 249.57 68.67 292.68 142.08 180.51 142.86"/><polygon class="cls-3' + uColors[1].replace('#', '') + '" points="123.17 46.14 180.22 142.86 180.51 142.86 173.73 154.38 173.48 154.38 116.46 58.51 123.17 46.14"/><polygon class="cls-4' + uColors[2].replace('#', '') + '" points="180.06 68.94 151.11 69.33 144.19 57.9 214.82 56.49 180.52 117.94 173.07 105.61 193.51 68.76 180.11 68.94 180.06 68.94"/><polygon class="cls-2' + uColors[0].replace('#', '') + '" points="81.49 69.81 95.22 69.9 152.32 166.28 137.95 166.24 81.49 69.81"/><polygon class="cls-3' + uColors[1].replace('#', '') + '" points="103.73 203.78 117.29 178.81 123.88 166.69 116.86 154.7 102.5 130.16 88.38 106.03 81.31 93.94 46.42 155.51 39.89 144.09 81.49 69.81 137.95 166.24 84.27 264.56 40.32 192.55 46.93 180.23 83.81 240.48 90.18 228.75 103.73 203.78"/><polygon class="cls-3' + uColors[1].replace('#', '') + '" points="180.11 68.94 193.51 68.76 173.07 105.61 180.52 117.94 165.81 93.63 180.06 68.94 180.11 68.94"/><polygon class="cls-3' + uColors[1].replace('#', '') + '" points="201.54 129.53 236.29 68.47 236.41 68.54 271.94 129.74 257.94 129.74 257.94 129.68 243.57 105.23 236.13 92.56 215.68 129.32 201.54 129.53"/><polygon class="cls-4' + uColors[2].replace('#', '') + '" points="81.31 93.94 88.38 106.03 88.33 106.06 74.48 130.81 67.31 143.63 109.36 142.71 116.68 154.81 46.42 155.66 46.42 155.51 81.31 93.94"/><polygon class="cls-4' + uColors[2].replace('#', '') + '" points="236.13 92.56 243.57 105.23 243.35 105.36 229.98 129.25 229.98 129.74 201.54 129.74 201.54 129.53 215.68 129.32 236.13 92.56"/><polygon class="cls-2' + uColors[0].replace('#', '') + '" points="102.5 130.16 116.86 154.7 116.68 154.81 109.36 142.71 67.31 143.63 74.48 130.81 74.71 130.93 102.07 130.41 102.5 130.16"/><polygon class="cls-4' + uColors[2].replace('#', '') + '" points="173.73 154.38 180.51 142.86 292.68 142.08 285.67 153.89 173.73 154.38"/><polygon class="cls-4' + uColors[2].replace('#', '') + '" points="137.95 166.24 152.32 166.28 152.47 166.52 98.34 264.11 84.27 264.56 137.95 166.24"/><polygon class="cls-2' + uColors[0].replace('#', '') + '" points="75.22 203.95 90.18 228.75 83.81 240.48 46.93 180.23 117.29 178.81 110.41 191.47 68.27 192.43 75.2 203.91 75.22 203.95"/><polygon class="cls-4' + uColors[2].replace('#', '') + '" points="117.29 178.81 103.73 203.78 75.22 203.95 75.2 203.91 68.27 192.43 110.41 191.47 117.29 178.81"/><polygon class="cls-2' + uColors[0].replace('#', '') + '" points="173.73 178.97 284.69 177.27 293.11 190.05 181.29 191.19 173.73 178.97 173.73 178.97"/><polygon class="cls-3' + uColors[1].replace('#', '') + '" points="173.45 178.98 173.73 178.97 173.73 178.97 181.29 191.19 125.66 288.43 118.67 276.21 173.45 178.98"/><polygon class="cls-4' + uColors[2].replace('#', '') + '" points="230.69 203.13 216.31 203.23 202.17 203.32 188.28 203.42 181.41 215.38 167.24 240.01 153.07 264.63 146.42 276.21 217.06 276.06 210.03 288.14 125.66 288.43 181.29 191.19 293.11 190.05 251.53 263.12 238.38 263.54 272.65 202.84 257.89 202.95 230.69 203.13"/><polygon class="cls-3' + uColors[1].replace('#', '') + '" points="202.17 203.32 216.31 203.23 237.56 239.53 244.7 226.68 257.89 202.95 272.65 202.84 238.38 263.54 238.25 263.61 202.17 203.32"/><polygon class="cls-2' + uColors[0].replace('#', '') + '" points="216.31 203.23 230.69 203.13 244.5 226.57 244.7 226.68 237.56 239.53 216.31 203.23"/><polygon class="cls-3' + uColors[1].replace('#', '') + '" points="167.24 240.01 181.41 215.38 174.24 227.88 195.49 264.27 182.08 264.38 182.03 264.38 167.24 240.01"/><polygon class="cls-2' + uColors[0].replace('#', '') + '" points="182.03 264.38 182.08 264.38 195.49 264.27 174.24 227.88 181.41 215.38 217.06 276.06 146.42 276.21 153.07 264.63 182.03 264.38"/></svg>'

        if(display){
            document.getElementById('body').innerHTML = SVG
        } else {
            return {HTML:SVG, attributes:[{name:'Color 1', value: uColors[0]},{name:'Color 2', value: uColors[1]},{name:'Color 3', value: uColors[2]}], sealed:''}
        }
        
}
//</script>
/*
//<script>
if (window.addEventListener) {
    window.addEventListener("message", onMessage, false);
    }
    else if (window.attachEvent) {
    window.attachEvent("onmessage", onMessage, false);
    }
    function onMessage(event) {
    var data = event.data;
    if (typeof(window[data.func]) == "function") {
    const got = window[data.func].call(null, data.message);
    window.parent.postMessage({
        'func': 'compiled',
        'message': got
        }, "*");
    }
    }
function onLoad(id){
    window.parent.postMessage({
        'func': 'loaded',
        'message': id
        }, "*");
}
//</script>
*/
//</head>
//<body id="body">Append ?NFT_UID to the address bar to see that NFT. "...html?A6"<script>const uid = location.href.split('?')[1]; if(uid){compile(uid, true)}else{onLoad(uid)}</script></body></html>
```

The script should return:
`{HTML:SVG, attributes:[{name:'Color 1', value: uColors[0]},{name:'Color 2', value: uColors[1]},{name:'Color 3', value: uColors[2]}], sealed:''}` 

HTML, which may include Base64 Imgs, GLTF, etc... plus an array of attributes, and optionally a sealed picture.

#### Advanced Example: Time-of-Day NFT (Type 2 - Executable)

This example shows a Type 2 Executable NFT that renders differently based on the current time of day. The base script provides the framework, and the executable code (updated via `nft_update_exe`) changes the scene:

**Base Script (stored in NFT set definition):**
```html
<!DOCTYPE html>
//<html><head><script>
function compile(message, display) {
    // Base landscape elements
    const landscapes = {
        dawn: {
            sky: '#FFB6C1',
            ground: '#90EE90', 
            sun: '#FFA500',
            title: 'Dawn Awakening',
            atmosphere: 'The world awakens with gentle pink hues'
        },
        day: {
            sky: '#87CEEB',
            ground: '#32CD32',
            sun: '#FFD700', 
            title: 'Bright Day',
            atmosphere: 'Full energy under the bright blue sky'
        },
        dusk: {
            sky: '#FF6347',
            ground: '#8B4513',
            sun: '#FF4500',
            title: 'Golden Dusk', 
            atmosphere: 'The day fades into warm golden tones'
        },
        night: {
            sky: '#191970',
            ground: '#2F4F4F',
            sun: '#F0F8FF',
            title: 'Starlit Night',
            atmosphere: 'Stars twinkle in the deep blue night'
        }
    };

    // Determine time period
    const hour = new Date().getHours();
    let period = 'day';
    if (hour >= 5 && hour < 8) period = 'dawn';
    else if (hour >= 8 && hour < 18) period = 'day';
    else if (hour >= 18 && hour < 21) period = 'dusk';
    else period = 'night';

    const scene = landscapes[period];
    
    // Execute custom code if available (from executable content)
    let customEffects = '';
    let customAttributes = [];
    if (typeof window.customTimeEffects === 'function') {
        try {
            const custom = window.customTimeEffects(period, scene, message);
            if (custom.effects) customEffects = custom.effects;
            if (custom.attributes) customAttributes = custom.attributes;
        } catch(e) {
            console.log('Custom effects error:', e);
        }
    }

    const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
        <defs>
            <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${scene.sky};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${scene.ground};stop-opacity:0.3" />
            </linearGradient>
            ${customEffects}
        </defs>
        
        <!-- Sky -->
        <rect width="400" height="200" fill="url(#skyGradient)"/>
        
        <!-- Ground -->
        <rect y="200" width="400" height="100" fill="${scene.ground}"/>
        
        <!-- Sun/Moon -->
        <circle cx="320" cy="80" r="30" fill="${scene.sun}" opacity="${period === 'night' ? '0.8' : '1'}"/>
        
        <!-- Mountains -->
        <polygon points="0,200 100,120 200,200" fill="#8B4513" opacity="0.7"/>
        <polygon points="150,200 250,100 350,200" fill="#A0522D" opacity="0.6"/>
        
        <!-- Trees (change with time) -->
        <rect x="50" y="160" width="8" height="40" fill="#8B4513"/>
        <circle cx="54" cy="150" r="15" fill="${period === 'night' ? '#2F4F4F' : '#228B22'}"/>
        
        <rect x="150" y="170" width="6" height="30" fill="#8B4513"/>
        <circle cx="153" cy="160" r="12" fill="${period === 'night' ? '#2F4F4F' : '#228B22'}"/>
        
        <!-- Time-based effects -->
        ${period === 'night' ? '<circle cx="100" cy="50" r="2" fill="white"/><circle cx="200" cy="40" r="1.5" fill="white"/><circle cx="300" cy="60" r="1" fill="white"/>' : ''}
        ${period === 'dawn' ? '<rect x="0" y="0" width="400" height="300" fill="pink" opacity="0.1"/>' : ''}
        
        <!-- Title -->
        <text x="200" y="280" text-anchor="middle" font-family="Arial" font-size="16" fill="white" stroke="black" stroke-width="1">${scene.title}</text>
    </svg>`;

    const baseAttributes = [
        {name: 'Time Period', value: period},
        {name: 'Scene', value: scene.title},
        {name: 'Atmosphere', value: scene.atmosphere},
        {name: 'Viewed At', value: new Date().toLocaleTimeString()}
    ];

    if(display){
        document.getElementById('body').innerHTML = SVG;
    } else {
        return {
            HTML: SVG, 
            attributes: [...baseAttributes, ...customAttributes], 
            sealed: ''
        };
    }
}

// Iframe/message handling for sandboxed execution
if (window.addEventListener) {
    window.addEventListener("message", onMessage, false);
} else if (window.attachEvent) {
    window.attachEvent("onmessage", onMessage, false);
}

function onMessage(event) {
    var data = event.data;
    if (typeof(window[data.func]) == "function") {
        const got = window[data.func].call(null, data.message);
        window.parent.postMessage({
            'func': 'compiled',
            'message': got
        }, "*");
    }
}

function onLoad(id){
    window.parent.postMessage({
        'func': 'loaded', 
        'message': id
    }, "*");
}
//</script></head>
//<body id="body">
<script>
const uid = location.href.split('?')[1]; 
if(uid){
    compile(uid, true);
} else {
    onLoad(uid);
}
</script>
</body></html>
```

**Example Executable Code (updated via nft_update_exe):**

💡 **SYSTEM IMPROVEMENT SUGGESTION**: 
The current system uses commas (`,`) as state delimiters, which restricts executable code. A better approach would be to change the system delimiter to `@` which would allow natural JavaScript syntax:

**Updated State Format (@-delimited):**
- Type 1: `lastModified` (Basic NFT - script is IPFS CID only)
- Type 2: `lastModified@executableCode` (Executable NFT)
- Type 3: `lastModified@optionalContent` (Additional options NFT)
- Type 4: `lastModified@executableCode@optionalContent` (Full dynamic NFT)

**✅ Code Changes Implemented:**
1. **helpers.js**: 
   - Updated `NFT.last()` function: `string.split(",")[0]` → `string.split("@")[0]`
   - Updated initial NFT state creation for all types (1,2,3,4)
   - Updated auction expiry functions to parse @ delimited state
2. **processing_routes/nft.js**: Updated all state parsing:
   - `nft.s.split(',')[0]` → `nft.s.split('@')[0]` (all occurrences)
   - `!json.exe.split(',')[1]` → `!json.exe.split('@')[1]` (validation)
   - State building: `${lastModified},${code}` → `${lastModified}@${code}`
3. **routes/api.js**: Updated API parsing:
   - `obj.s.split(',')[0]` → `obj.s.split('@')[0]` for last_modified extraction

**Benefits:**
- ✅ Natural JavaScript syntax in executable code
- ✅ Support for objects, arrays, function parameters
- ✅ No syntax restrictions for developers
- ✅ `@` symbol is safe (not a JS operator)

**With @ delimiters, natural JavaScript would work:**
```javascript
window.customTimeEffects = function(period, scene, nftId) {
    const effects = {
        dawn: '<filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
        day: '<filter id="bright"><feColorMatrix values="1.2 0 0 0 0  0 1.2 0 0 0  0 0 1.2 0 0  0 0 0 1 0"/></filter>',
        dusk: '<filter id="warm"><feColorMatrix values="1.1 0.1 0 0 0  0 0.9 0.1 0 0  0 0 0.8 0 0  0 0 0 1 0"/></filter>',
        night: '<filter id="cool"><feColorMatrix values="0.7 0 0.2 0 0  0 0.7 0.3 0 0  0.1 0.1 1 0 0  0 0 0 1 0"/></filter>'
    };
    
    const customAttrs = [
        {name: 'Enhancement', value: 'Dynamic Time Effects Active'},
        {name: 'Filter Applied', value: period.charAt(0).toUpperCase() + period.slice(1)},
        {name: 'NFT ID Hash', value: nftId}
    ];
    
    return {
        effects: effects[period] || '',
        attributes: customAttrs
    };
};
```

**How to create this NFT:**

1. **Define the NFT Set (Type 2):**
```json
{
    "name": "timescape",
    "type": 2,
    "script": "[IPFS CID of BASE_SCRIPT_ABOVE]",
    "permlink": "creator/timescape-announcement", 
    "start": "00",
    "end": "ZZ",
    "exe_size": 2048,
    "handling": "html",
    "max_fee": 5000000,
    "bond": 500
}
```

2. **Mint an NFT:**
```json
{
    "set": "timescape"
}
```

3. **Add Custom Effects (optional):**
```json
{
    "set": "timescape",
    "uid": "AA", 
    "exe": "window.customTimeEffects=function(period,scene,nftId){const effects={dawn:'...',day:'...'}; return {effects:effects[period],attributes:[]}; }"
}
```

**Note**: With `@` delimiters, full JavaScript syntax including commas, objects, and arrays would work naturally!

**Execution Contexts:**
- **Browser**: Full rendering with real-time updates
- **Node.js**: Server-side rendering for static snapshots  
- **Iframe**: Sandboxed execution for security in marketplaces

This NFT will show different scenes based on when it's viewed (dawn/day/dusk/night) and owners can enhance it with custom effects through the executable code!

### NFT Define Delete (id: dlux_nft_define_delete)

This action deletes an NFT set definition. Only works if no NFTs have been minted from the set (i.e., issued counter is still "0"). Refunds the set creation fee.

#### params:
* set = string representing the name of the NFT set to delete

#### example:
```json
{
    "set": "dlux"
}
```

### NFT Mint (id: dlux_nft_mint)

This action redeems a mint token to create a new NFT from a set. Uses chronological assignment for fair distribution.

#### params:
* set = string representing the name of the NFT set

#### example:
```json
{
    "set": "dlux"
}
```

### NFT Auction (id: dlux_nft_auction)

This action lists an NFT for auction on the market. Temporarily changes owner to 'ah'. Creates a countdown timer for auction expiration.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT
* price = integer with 3 precision representing the starting price (default: 1000)
* now = integer representing 'buy it now' price (not implemented)
* time = integer representing the number of days before auction closes (1-30 days, default: 7)

#### example:
```json
{
    "set": "dlux",
    "uid": "AA",
    "price": 1000,
    "now": 10000,
    "time": 7
}
```

### NFT HIVE/HBD Auction (id: dlux_nft_hauction)

This action lists an NFT for auction accepting HIVE or HBD payments. Similar to regular auction but with cryptocurrency payments.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT
* price = integer representing starting price in milliunits
* type = string - 'HIVE' or 'HBD' (defaults to 'HIVE')
* now = integer representing 'buy it now' price (not implemented)
* time = integer representing days before auction closes (1-7 days, default: 7)

#### example:
```json
{
    "set": "dlux",
    "uid": "AA",
    "price": 1000,
    "type": "HIVE",
    "time": 7
}
```

### NFT Auction Bidding (id: dlux_nft_bid)

This action makes a bid for an active NFT auction. Automatically refunds previous high bidder.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT
* bid_amount = integer representing amount to bid, with 3 precision

#### example:
```json
{
    "set": "dlux",
    "uid": "AA",
    "bid_amount": 1000
}
```

### NFT Sell (id: dlux_nft_sell)

This lists an NFT for direct sale on the market. Supports TOKEN, HIVE, or HBD pricing.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT
* price = integer representing sale price with 3 precision (default: 1000)
* type = string (optional) - 'HIVE', 'HBD', or defaults to TOKEN

#### example:
```json
{
    "set": "dlux",
    "uid": "AA",
    "price": 1000,
    "type": "HIVE"
}
```

### NFT Market Buy (id: dlux_nft_buy)

This action purchases an NFT from the direct sale market. Only works for TOKEN-priced listings, not HIVE/HBD listings.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT

#### example:
```json
{
    "set": "dlux",
    "uid": "AA"
}
```

### NFT Sell Cancel (id: dlux_nft_sell_cancel)

This action cancels an NFT market sale listing and returns the NFT to the owner.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT

#### example:
```json
{
    "set": "dlux",
    "uid": "AA"
}
```

### NFT Dividend Setup (id: dlux_nft_div)

This action establishes a dividend system for an NFT set. Only the set creator can establish dividends.

#### params:
* set = string representing the name of the NFT set
* period = integer representing time in blocks for dividend period (28800-864000 blocks)

#### example:
```json
{
    "set": "dlux",
    "period": 28800
}
```

### NFT Update Executable (id: dlux_nft_update_exe)

This action updates the executable content of an NFT (types 2 and 4 only). Size must be within limits set during NFT set creation.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT
* exe = string representing the executable content (must not contain commas)

#### example:
```json
{
    "set": "dlux",
    "uid": "AA",
    "exe": "console.log('Hello World')"
}
```

### NFT Update Options (id: dlux_nft_update_opt)

This action updates the optional content of an NFT (types 3 and 4 only). Size must be within limits set during NFT set creation.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the unique ID of the NFT
* opt = string representing the optional content (must not contain commas)

#### example:
```json
{
    "set": "dlux",
    "uid": "AA",
    "opt": "additional metadata"
}
```

### NFT Add Royalties (id: dlux_nft_add_roy)

This action modifies the royalty distribution for an NFT set. Only available to set creators or existing royalty recipients.

#### params:
* set = string representing the name of the NFT set
* distro = string representing distribution in format 'account1_percentage,account2_percentage' (must total 10000)

#### example:
```json
{
    "set": "dlux",
    "distro": "account1_5000,account2_5000"
}
```

## FT (fungible token / mint token) Actions

These actions manage fungible tokens (FTs) which represent mint tokens for NFT sets.

### FT Transfer (id: dlux_ft_transfer)

This action transfers mint tokens from one wallet to another.

#### params:
* set = string representing the name of the NFT set
* to = string representing the destination wallet
* qty = integer representing quantity to transfer (default: 1)

#### example:
```json
{
    "set": "dlux",
    "to": "somebody",
    "qty": 5
}
```

### FT Airdrop (id: dlux_ft_airdrop)

This action airdrops mint tokens to multiple wallets simultaneously. Automatically deduplicates recipient list.

#### params:
* set = string representing the name of the NFT set
* to = array of strings representing wallets to airdrop to

#### example:
```json
{
    "set": "dlux",
    "to": ["somebody", "someother", "another"]
}
```

### FT Escrow (id: dlux_ft_escrow)

This action creates an escrow contract for a mint token sale.

#### params:
* set = string representing the name of the NFT set
* to = string representing the buyer
* price = integer representing the price with 3 precision

#### example:
```json
{
    "set": "dlux",
    "to": "buyer",
    "price": 1000
}
```

### FT Escrow Complete (id: dlux_ft_escrow_complete)

This action completes an escrow mint token purchase.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the contract ID

#### example:
```json
{
    "set": "dlux",
    "uid": "contract123"
}
```

### FT Escrow Cancel (id: dlux_ft_escrow_cancel)

This action cancels a mint token escrow contract.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the contract ID

#### example:
```json
{
    "set": "dlux",
    "uid": "contract123"
}
```

### FT Sell (id: dlux_ft_sell)

This action lists a mint token for direct sale.

#### params:
* set = string representing the name of the NFT set
* price = integer representing sale price (default: 1000)

#### example:
```json
{
    "set": "dlux",
    "price": 1500
}
```

### FTs Sell for HIVE/HBD (id: dlux_fts_sell_h)

This action lists multiple mint tokens for sale accepting HIVE or HBD payments with custom distribution.

#### params:
* set = string representing the name of the NFT set
* quantity = integer representing number of mint tokens to sell
* hive = integer representing price in millihive (mutually exclusive with hbd)
* hbd = integer representing price in millihbd (mutually exclusive with hive)
* distro = string representing payout distribution 'account1_percentage,account2_percentage' (must total 10000)
* enforce = boolean representing whether to enforce exact payment

#### example:
```json
{
    "set": "dlux",
    "hive": 1000,
    "quantity": 100,
    "distro": "seller_8000,platform_2000"
}
```

### FTs Sell HIVE/HBD Cancel (id: dlux_fts_sell_hcancel)

This action cancels a HIVE/HBD mint token sale, refunding pending purchases.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the contract ID

#### example:
```json
{
    "set": "dlux",
    "uid": "contract123"
}
```

### FT Buy (id: dlux_ft_buy)

This action purchases a mint token from the direct sale market.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the listing ID

#### example:
```json
{
    "set": "dlux",
    "uid": "listing123"
}
```

### FT Sell Cancel (id: dlux_ft_sell_cancel)

This action cancels a mint token sale listing.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the listing ID

#### example:
```json
{
    "set": "dlux",
    "uid": "listing123"
}
```

### FT Auction (id: dlux_ft_auction)

This action lists a mint token for auction.

#### params:
* set = string representing the name of the NFT set
* price = integer representing starting price (default: 1000)
* time = integer representing auction duration in days (1-30, default: 7)
* now = integer representing buy-it-now price

#### example:
```json
{
    "set": "dlux",
    "price": 1000,
    "time": 7,
    "now": 5000
}
```

### FT Bid (id: dlux_ft_bid)

This action places a bid on a mint token auction.

#### params:
* set = string representing the name of the NFT set
* uid = string representing the auction ID
* bid_amount = integer representing bid amount with 3 precision

#### example:
```json
{
    "set": "dlux",
    "uid": "auction123",
    "bid_amount": 1500
}
```

---

# Smart Contract Proposal (SCP) System

The Smart Contract Proposal (SCP) system, defined in `processing_routes/scp.js`, allows users to propose, vote on, and implement changes or actions within the HoneyComb network. This system is crucial for the decentralized governance and evolution of the platform.

## Overview

The SCP system revolves around three main operations:

1.  **`scp_add` (Proposing a Contract):**
    *   Allows any user with an active key to submit a new smart contract proposal.
    *   Proposals include a function name (`func`), a contract path (`path`), and a type that specifies when the contract should execute (e.g., `onOperation`, `on`, `api`, `chron`).
    *   Each proposal is assigned a unique ID (derived from the transaction ID).
    *   An `approvals` map is created, initially setting all multisig authority accounts' votes to 0.
    *   A `threshold` for the number of positive votes required for approval is set based on current multi-sig threshold.
    *   A countdown (`chronAssign`) is initiated, typically for 201600 blocks (around 7 days), after which the proposal will automatically end if not approved or acted upon.
    *   The proposal details and a feed message are stored on the network.

2.  **`scp_del` (Deleting a Proposal):**
    *   Allows the original proposer to withdraw their smart contract proposal.
    *   This action removes the proposal from the system and cancels the associated countdown timer.
    *   A feed message confirms the deletion.

3.  **`scp_vote` (Voting on a Proposal):**
    *   Enables holders of the multisig authority to cast their vote (approve or reject) on an existing proposal.
    *   Votes are recorded as `1` for approval and `-1` for rejection. Users can change their vote.
    *   After each vote, the system checks if the total number of approvals meets or exceeds the proposal's `threshold`.
        *   **If Approved:** The proposal's countdown timer (`chron`) is rescheduled to execute in the next block. This effectively fast-tracks the proposal for implementation. A feed message announces the approval.
        *   **If Not Yet Approved:** The proposal is updated with the new vote, and a feed message records the vote.

## How to Interact with the SCP System

Interactions with the SCP system are typically done by broadcasting custom\_json operations on the Hive blockchain with the appropriate IDs and parameters.

### 1. Creating a Proposal (scp_add)

To propose a new smart contract:

*   **ID:** `scp_add` (or the prefix defined in your config, e.g., `yourprefix_scp_add`)
*   **Required JSON fields:**
    *   `type`: (Integer 1-4)
        *   `1`: `onOperation` - Triggers on a Hive operation.
        *   `2`: `on` - custom_json listener.
        *   `3`: `api` - Exposes an API endpoint.
        *   `4`: `chron` - Schedules a recurring task.
    *   `path`: (String) The executable name.
    *   `func`: (String) The function.toString(), it will be eval() with some context passed to it.

**Example JSON:**

```json
{
  "type": 1,
  "path": "comment",
  "func": "...",
}
```
Overrides the existing smart contract for comment parsing and action. Maybe a new type of Proof of Brain.

```json
{
  "type": 2,
  "path": "scp_vote",
  "func": "...",
}
```
Overrides the scp_vote contract, maybe to increase the approval margin.
```json
{
  "type": 4,
  "path": "scp_vote",
  "func": "...",
}
```
Adds a new chron op, maybe to interact with your new scp_vote algorithm.


### 2. Deleting a Proposal (`scp_del`)

To delete a proposal you created:

*   **ID:** `scp_del` (or `yourprefix_scp_del`)
*   **Required JSON fields:**
    *   `id`: (String) The `transaction_id` of the proposal you want to delete.
    *   `transaction_id`: (String) The Hive transaction ID of this deletion custom_json.
    *   `block_num`: (Integer) The current Hive block number.

**Example JSON:**

```json
{
  "id": "abcdef1234567890",
}
```

### 3. Voting on a Proposal (`scp_vote`)

To vote on an active proposal:

*   **ID:** `scp_vote` (or `yourprefix_scp_vote`)
*   **Required JSON fields:**
    *   `id`: (String) The `transaction_id` of the proposal you are voting on.
    *   `approve`: (Boolean) `true` to approve, `false` to reject.
    *   `transaction_id`: (String) The Hive transaction ID of this voting custom_json.
    *   `block_num`: (Integer) The current Hive block number.

**Example JSON (Approve):**

```json
{
  "id": "abcdef1234567890",
  "approve": true,
}
```

**Example JSON (Reject):**

```json
{
  "id": "abcdef1234567890",
  "approve": false,
}
```

This system ensures that changes to the HoneyComb network are transparent, community-driven, and subject to a consensus mechanism before implementation.

### 4. Creating a function

Context passed to the functions allow it to interact with all parts of state and most helper functions used... { store, config, API, VERSION, getPathObj, getPathNum, getPathSome, RAM, burn, forceCancel, add, addc, addMT, addCol, addGov, deletePointer, credit, nodeUpdate, penalty, chronAssign, hashThis, isEmpty, postToDiscord, Base64, Base58, stringify, NFT, Chron, stringify, DEX, naizer, status, verifySig }

Inspect spk.config.js for examples of all types of contracts and how they are written and interact.

```{
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
  }```

  For instance, the broca_calc is a custom function and isn't part of the base honeycomb context, it needs to be defined everywhere it's used. It uses Base64, so that will be pulled from the passed context to use it here. 

  Generally speaking. Each function gets the json of the op as triggered on chain. You pull information from the state via getPathObj and getPathNum (these will default to {} and 0 if none exist) and then you perform any actions to the state as you need. 

  Replacing state works just fine, but deleting anything requires special and upfront attention. 

  store.batch will perform memory actions (deletes first) then puts, and pass the block information to the next operation via pc (the promise chain)

  All together you can store new state, provide API to have users interact with that state, and define new virtual operations via the chron to perform time based actions like expiration on that state.

## NFT Types and State Format

The HoneyComb NFT system supports 4 different NFT types (Types 1-4), each with different capabilities and state formats. **Note: There is no Type 0 NFT** - all NFTs require minting through mint tokens.

### Type 1: Basic NFT (Static Content)
- **Purpose**: Simple static NFTs with IPFS content reference
- **State Format**: `lastModified`
- **Script Field**: Contains IPFS CID pointing to static content
- **Minting**: Requires mint tokens
- **Use Cases**: Traditional collectibles, static art, certificates

### Type 2: Executable NFT (Dynamic Content)
- **Purpose**: NFTs with updatable JavaScript code
- **State Format**: `lastModified@executableCode`
- **Script Field**: Contains IPFS CID for base template/framework
- **Minting**: Requires mint tokens
- **Use Cases**: Interactive NFTs, games, dynamic visualizations

### Type 3: Optional Content NFT (Extended Metadata)
- **Purpose**: NFTs with additional metadata content
- **State Format**: `lastModified@optionalContent`
- **Script Field**: Contains IPFS CID for base content
- **Minting**: Requires mint tokens
- **Use Cases**: NFTs with evolving descriptions, community content

### Type 4: Full Dynamic NFT (Executable + Optional)
- **Purpose**: Complete dynamic NFTs with both executable code and optional content
- **State Format**: `lastModified@executableCode@optionalContent`
- **Script Field**: Contains IPFS CID for base framework
- **Minting**: Requires mint tokens
- **Use Cases**: Complex interactive applications, evolving games

## API Enhancements for NFT State Parsing

The API now includes helper functions that automatically parse NFT state data for easier consumption:

### Enhanced NFT Data Structure
```json
{
  "uid": "AA",
  "set": "dlux",
  "info": "Qm...@console.log('Hello World')@{\"description\":\"Dynamic NFT\"}",
  "state": {
    "lastModified": 12345678,
    "lastModifiedBlock": 12345678,
    "type": "dynamic",
    "description": "Full dynamic NFT with executable code and optional content",
    "executableCode": "console.log('Hello World')",
    "optionalContent": "{\"description\":\"Dynamic NFT\"}"
  },
  "nftType": "dynamic",
  "typeDescription": "Full dynamic NFT with executable code and optional content",
  "executableCode": "console.log('Hello World')",
  "optionalContent": "{\"description\":\"Dynamic NFT\"}",
  "lastModified": 12345678,
  "lastModifiedBlock": 12345678
}
```

### Affected API Endpoints
- `/nfts/:user` - User's NFT collection with parsed state
- `/auctions/:set?` - Auction listings with enhanced NFT data
- `/sales/:set?` - Sale listings with enhanced NFT data  
- `/item/:set/:item` - Individual NFT details with parsed state

### State Delimiter System
The system uses `@` as the delimiter for NFT state data, allowing natural JavaScript syntax in executable code while maintaining proper state separation. 

