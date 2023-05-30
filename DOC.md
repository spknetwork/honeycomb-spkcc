# Documentation

## Theory

### Account Registration

To minimize on-chain messaging, a public key is required to verify contract parts and roll them back into the chain when a complex operation has completed. The PubKey should be a posting key of the account, and must be signed and broadcasted with the active key. This key will be used by a party to verify accurate content at every step in the storage and/or service process. 

For example: If a user wants to place illegal content in a storage contract an upload provider would be able to replace a users content with their content and perform a man in the middle attack. With the posting keys the uploader and the reciever will have to agree on the hash of an item and any illegal content will be correctly attributed, lowering risk for service providers and users alike. 

### Service Registration

Allows any account holder to register an IPFS api endpoint. These can accept uploads, or function as storage providers, or both.

### SPK Power Up

Places SPK in a "powered" state that builds BROCA resources and counts toward governance votes. 

## Practice

List of SPK Network Transactions

### Account Registration

#### Enforcement: 

Signed with: active
json.pubKey
typeof json.pubKey is "string"
json.pubKey.substr(0, 3) == "STM"
json.pubKey.length == 53

#### Transaction: Custom_Json

required_auths: ["account"]
required_posting_auths:	[]
id:	`spkcc_register_authority`
json:	{"pubKey":"STM6ZBHjpWxTngbyA9U1sGZZp4rkXoRkRHaHsrUjvjsPgtt6StFzH"}

### SPK Power Up

#### Enforcement: 

Signed with: active
json.amount # in milliSPK 1000 = 1.000 SPK
typeof json.amount is INT
amount <= SPK balance

#### Transaction: Custom_Json

required_auths: ["account"]
required_posting_auths:	[]
id:	`spkcc_spk-up`
json:	{"amount": 1000}

### Service Registration

### Channel Open

How to build an upload contract. Two contract types exist currently.
* 0 : simple. Pay upfront
* 1 : beneficiary. Include finalization details so the uploader has to build a post with correct credits
   * must include json.slots to build the beneficiary watcher. 

#### Transaction: Custom_Json

required_auths: []
required_posting_auths:	["account"]
id:	`spkcc_channel_open`
json:	{"broca": 1000,
	contract: 0 | 1,
	slot: 'dlux-io,1000' // required for type 1
	to: "file_owner",
	broker: "upload_account"}

#### Enforcement
* json.broker must have a registered service
* All three accounts must have a pubKey registered
* Account must have Broca 
* json.slots must match
* A channel between from and to must not be open (uploads complete, beneficiary post made)

```
if (typeof template.i != "string") err += `Contract doesn't exist.`
      if (typeof authF != 'string') err += `@${from} hasn't registered a public key. `
      if (typeof authT != "string") err += `@${json.to} hasn't registered a public key. `;
      if (typeof authB != "string") err += `@${json.broker} hasn't registered a public key. `;
      if (!Object.keys(broker).length) err += `@${json.broker} IPFS service error. `
      if (proffer.e) err += `This channel exists: ${proffer.e.split(':')[1]} `
      if (json.broca > broca || json.broca < stats.channel_min) err += `@${from} doesn't have enough BROCA to build a channel. `;
      if (json.slots && template.s != json?.slots.split(',').length) err += `Slots mismatch.`;//checker for slots against contract... enforcement of benificaries
```

### Channel Update

For Finalizing uploads.
Sent from the upload middleware. The nodes accept that the files posted in the transaction have been signed by the upload node in the brodcast. The payload must also include the signature of the file owner/uploader to verify everybody agrees on file providence. 

### Extend

Extend the time of a file storage contract. Since contracts are priced via current market rates, the broca sent will extend the contract to the nearest 3 second period covered. Optionally increase the "decentralization power" of the contract. The appended amounts can come from any account. If the file owner cancels the contract the broca will be sent back to the originating account not to exceed the accounts max broca level. 

#### JSON

required_auths: []
required_posting_auths:	["account"]
id:	`spkcc_extend`
json:	{"broca": 1000,
	id:
	file_owner
	power: 0 | 1}

#### Enforcement

Contract must exist. Account must have broca. Possible time limit... 

### Store & Remove

Attaches a storage account to a contract to check during validations. Unvalidated content will drop the overall rewards of an account and it's delegates, so proper attestation is required. There is no penalty for removing content from your storage nodes.

#### JSON

required_auths: []
required_posting_auths:	["account"]
id:	`spkcc_store` || 'spkcc_remove'
json:	{[...ids]}

### Contract Close

#### JSON

required_auths: []
required_posting_auths:	["account"]
id:	`spkcc_contract_close`
json:	{id}

#### Enforcement

Only the file owner can close a contract.

## API

### /@:user

Has several more fields including open and pending contracts

### /api/contract/:to/:from/:id

How to query a pending contract

### /api/fileContract/:id

Query a contract by ID

### /api/file/:id

Query a contract by asset

### /user_services/:un

Query services by user

### /services/:type

Query services by type

## API Helpers

To ease the compute load on chain several parameters must be calculated on the client side:

### Broca Total

Function and API to feed it.

`(/@account.broca, /@account.spk_power, /stats, /hive.head_block)`

```
broca_calc = (last, pow, stats, bn) => {
    const last_calc = require('./helpers').Base64.toNumber(last.split(',')[1])
    const accured = parseInt((parseFloat(stats.broca_refill) * (bn - last_calc))/(pow * 1000))
    var total = parseInt(last.split(',')[0]) + accured
    if(total > (pow * 1000))total = (pow * 1000)
    return `${total},${Base64.fromNumber(bn)}`
}
```

### Base64

Used to decompress block numbers mostly. Keeps State files smaller.

```
const Base64 = {
  glyphs64: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=",
  fromNumber: function (number) {
    if (
      isNaN(Number(number)) ||
      number === null ||
      number === Number.POSITIVE_INFINITY
    )
      throw "The input is not valid";
    if (number < 0) throw "Can't represent negative numbers now";
    var char;
    var residual = Math.floor(number);
    var result = "";
    while (true) {
      char = residual % 64;
      result = this.glyphs64.charAt(char) + result;
      residual = Math.floor(residual / 64);
      if (residual == 0) break;
    }
    return result;
  },

  toNumber: function (chars) {
    var result = 0;
    chars = chars.split("");
    for (var e = 0; e < chars.length; e++) {
      result = result * 64 + this.glyphs64.indexOf(chars[e]);
    }
    return result;
  },

  fromFlags: function (flags) {
    // array [1,0,1,1,0,0,1]
    var result = 0;
    var last = 1;
    for (var i = 0; i < flags.length; i++) {
      result = result + last * flags[i];
      last = last * 2;
    }
    return this.fromNumber(result);
  },

  toFlags: function (chars) {
    var result = [];
    chars = chars.split("");
    for (j = 0; j < chars.length; j++) {
      for (var i = 32; i >= 1; i = i / 2) {
        if (this.glyphs64.indexOf(chars[j]) >= i) {
          result.unshift(1);
          chars[j] = this.glyphs64[this.glyphs64.indexOf(chars[j]) - i];
        } else {
          result.unshift(0);
        }
      }
    }
    return result;
  },
};
```
