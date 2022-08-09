# Release Notes

## 1.1

### 1.1.0

* Build SPK send
* Build SPK accounting
* Introduce SPK reward based on Larynx Power
* Allow Larynx "Power Up and Power Grant"
* Code Initial APR for SPK distro
* Refix DEX Fees
* Rework IPFS Promise

## 1.0

### 1.0.10

* Update IPFS lib to ipfs-http-client-lite
* Fix Possible Negative Calculation

### 1.0.6

* Update fee calculation for buy orders
* Fix account update signing and resigning
* Remove 1.0.4 data insertion

### 1.0.5

* Won't post 0 amount orders if the order was safely refunded

### 1.0.4

* DAO Fee calculation
* Running total DAO token calculation
* Stop 0 hive transfers
* DEX will put extra remaining in fees to reduce 0 value orders
* Added a process to claim dex fees
* New Healing Algorithm to reduce time of no consensus
* Added checks for negative rate asks and bids
* Force Remove 0.000 Transfers from queue
* Removed Processor intensive API from standard suite (can run in test mode for these APIs)

### 1.0.3

* Emergency Fixes

### 1.0.2

* Emergency Fixes

### 1.0.1

* Emergency Fixes

## 1.0.0b

* Updated consensus mechanism for scaling
* Updated restarts for scaling mechanism
* New witness promotion routine
* Dockerized with own IPFS dependencies
* Fast Replay
* Auto IPFS Swarms
* Autonomous Multi-sig Account Management
* Accurate Tracking of collateralized safety margins
* Enforcement of safety margins
* Added a claim routine to ease tax reporting
* Half of claims locked in gov or power
* Opened NFT minting to all accounts
* Fixed DEX history
* Fixed DEX sell loop for expired trades
* Implemented multiple hive-js node selection
* Dockerized Snapshot Portal
* Token API Snapshot Crossover
* Initial State File Build
