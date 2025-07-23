# SPK Schema vs Implementation Comparison

## Overview
This document compares the GraphQL schema in `/home/jr/dlux/honeygraph/schema/spk-schema.graphql` with the actual implementation in the honeycomb-spkcc codebase.

## 1. Account Structure

### Schema Definition
```graphql
type Account {
  username: String! @id
  larynxBalance: Int
  spkBalance: Int
  brocaBalance: String # "amount,blocknum" format
  liquidBroca: Int
  govBalance: Int
  govLocked: Int
  power: Int
  powerGranted: Int
  powerGrantedTo: [PowerGrant]
  powerReceivedFrom: [PowerGrant]
  ...
}
```

### Implementation Reality
Based on the code analysis, accounts are stored in a key-value structure:
- **balances[account]**: Main token balance (LARYNX/SPK)
- **cbalances[account]**: Claimable balances
- **pow[account]**: Power balance
- **gov[account]**: Governance balance
- **broca[account]**: BROCA balance (stored as "amount,blocknum" string)
- **granted[account]**: Object containing granted powers to other accounts
- **granting[account]**: Power granting relationships

**Key Differences:**
- No separate larynxBalance/spkBalance - just "balances"
- BROCA is stored as a string with block number
- Power grants are stored in nested objects, not as separate entities

## 2. Storage Contracts

### Schema Definition
```graphql
type StorageContract {
  id: String! @id # owner:txid
  owner: Account!
  price: Int!
  rate: Float!
  duration: Int!
  uploaders: Int!
  files: [File]
  dataFiles: String # df
  validations: Int # v
  storageNodes: [Account] # n
  ...
}
```

### Implementation Reality
Contracts are stored at `contract[owner][txid]` with structure:
```javascript
{
  i: "contract_id",
  t: "owner",
  r: rate, // BROCA cost
  p: power_multiple,
  u: total_bytes,
  v: validations_count,
  e: expiry_block_path,
  c: contract_type (3 for storage),
  n: { "1": "node1", "2": "node2", ... }, // Storage nodes
  nt: "2", // Number of nodes (Base64)
  df: { "cid1": bytes1, "cid2": bytes2, ... }, // Files
  m: "metadata", // Comma-separated or JSON
  ex: "extensions" // Comma-separated
}
```

**Key Differences:**
- `n` field stores nodes as an object with Base64 keys, not an array
- `df` (dataFiles) is an object mapping CIDs to byte sizes
- No separate File entities - files are embedded in contract
- Uses single-letter keys for efficiency

## 3. DEX and Market Structures

### Schema Definition
```graphql
type DexOrder {
  id: String! @id
  owner: Account!
  type: OrderType!
  pair: String!
  rate: Float!
  amount: Int!
  filled: Int!
  status: OrderStatus!
  ...
}
```

### Implementation Reality
DEX is stored at `dex[pair]` (e.g., `dex.hive`, `dex.hbd`) with:
```javascript
{
  buyOrders: { "rate:txid": orderObject, ... },
  sellOrders: { "rate:txid": orderObject, ... },
  buyBook: "rate1_txid1,txid2_rate2_txid3,...", // Order book string
  sellBook: "rate1_txid1,txid2_rate2_txid3,...",
  tick: "current_price",
  pool: {
    token: amount,
    hive/hbd: amount,
    lpTokens: total_lp_tokens,
    maxSupply: max_tokens (for bonding curve)
  },
  his: [...], // History array
  days: { blocknum: stats, ... }
}
```

**Key Differences:**
- Orders are stored in nested objects, not as separate entities
- Order books are comma-separated strings for efficiency
- Pool is embedded in DEX structure, not separate
- No LiquidityPosition entities - tracked in `dex.liq[account]`

## 4. Services and Nodes

### Schema Definition
```graphql
type Service {
  id: String! @id
  provider: Account!
  type: ServiceType!
  endpoint: String
  ...
}

type StorageNode {
  account: Account! @id
  domain: String
  peerId: String
  ...
}
```

### Implementation Reality
Services are stored at `service[type][account]`:
```javascript
{
  a: "api_endpoint",
  c: collateral,
  m: "memo/description"
}
```

Node market entries at `markets[account]`:
```javascript
{
  b: bid_rate,
  a: bid_amount,
  w: wins,
  t: attempts,
  g: last_good_block,
  code: validation_code
}
```

**Key Differences:**
- Services are grouped by type, not stored as individual entities
- Very minimal service information stored
- Node market info is separate from service info
- No structured ServiceEndpoint entities

## 5. Virtual File System (VFS)

### Schema Definition
```graphql
type VFSEntry {
  path: String! @id
  owner: Account!
  type: VFSType!
  cid: String
  parent: VFSEntry
  children: [VFSEntry]
  ...
}
```

### Implementation Reality
**NOT IMPLEMENTED** - No VFS structure found in the codebase. Files are only tracked within storage contracts.

## 6. Governance/Proposals

### Schema Definition
```graphql
type Proposal {
  id: String! @id
  proposer: Account!
  type: ProposalType!
  approvals: [Account]
  rejections: [Account]
  ...
}
```

### Implementation Reality
Multisig proposals at `mss[id]`:
```javascript
{
  p: [path, array], // Operation path
  d: data, // Operation data
  a: ["approver1", "approver2", ...], // Approvals array
  t: expiry_block,
  n: memo
}
```

**Key Differences:**
- Only multisig proposals implemented, not general governance
- Approvals are string arrays, not Account references
- No rejection tracking

## 7. Validations

### Schema Definition
```graphql
type Validation {
  id: ID!
  file: File!
  node: StorageNode!
  contract: StorageContract!
  blockNum: Int!
  challenge: String!
  response: String!
  valid: Boolean!
  ...
}
```

### Implementation Reality
Validations are not stored as separate entities. They are:
- Tracked in contract.v (validation count)
- Handled in RAM.Pending for active validations
- Results influence node market scores

## 8. Missing from Implementation

1. **File entities** - Files only exist within contracts
2. **VFS (Virtual File System)** - Not implemented
3. **PowerGrant entities** - Stored as nested objects in granted[from][to]
4. **Delegation entities** - Only tracks delegations[account] = vests
5. **Transaction/Feed as structured entities** - Feed is simple strings
6. **ServiceEndpoint entities** - Not implemented
7. **Auction entities** - Only auction[account] = amount
8. **StatsSnapshot** - Stats are updated in place, not snapshotted
9. **Structured Validation records** - Not persisted

## 9. Implementation-Only Features

1. **NFT System** - Extensive NFT implementation not in GraphQL schema
2. **Beneficiaries (ben)** - Content beneficiary tracking
3. **Collateral/Escrow** - For various operations
4. **Chrono operations** - Scheduled/delayed operations
5. **Authorities** - Node authority levels
6. **Report/Validation codes** - For ProofOfAccess

## Recommendations

1. **Schema Updates Needed:**
   - Add NFT types and structures
   - Simplify to match actual k:v storage patterns
   - Remove unimplemented features (VFS, separate File entities)
   - Add implementation-specific features

2. **Implementation Considerations:**
   - The k:v structure is optimized for efficiency
   - GraphQL schema should map to views/projections of this data
   - Consider computed fields for relationships

3. **Data Transformation Layer:**
   - Need transformation logic between k:v and GraphQL types
   - Handle nested object to array conversions
   - Compute derived fields (e.g., file counts from df objects)