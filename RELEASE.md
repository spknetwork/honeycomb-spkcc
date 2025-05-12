# Release Notes

## 1.5

* Support Token Builder
* Store community variables in state and account data
* Switch to ES6 Code
* Removed legacy code and configurations

### 1.4.5

* Hive NFT Auction stall fix

### 1.4.4

* Bug Fixes

### 1.4.3

* Bug Fixes

### 1.4.2

* Bug Fixes

### 1.4.1

* Bug Fixed

## 1.4

* Moved all supported actions to configuration files to allow Honey Comb communities to continue to receive updates from a standard source

## 1.3

### 1.3.4

* Switch back to hive-tx after updates to package.
* Retooling transaction verification and broadcasting
* Quiet logging unless env.mode == 'verbose'
* Fix error on account update logic
* Allow for API address updates via configuration

### 1.3.3

* Fix Liquidity Rewards

### 1.3.2

* Remove artifacts

### 1.3.1

* Fix signature verification
* Fix Auto-Healing Consensus
* Backoff timer in processor retries

### 1.3.0

* Can Add IPFS Node API
* Ensure Consensus has a majority of owners (double majority)
* Ensure reassembled State is equivalent to Consensus
* Allow for more than 3 Multi-Signature holders
* Verify Signature without outside of HiveAPI
* GetBlock Retry
* Fix Downpower memory leak.
* Fix NFT token check
* Add API for Downpower
* Docker Network Specified
* IPFS image and network dependencies change

## 1.2

* Updated restarts for scaling mechanism
* Updated consensus mechanism for scaling
* New witness promotion routine
* Dockerized with own IPFS dependencies
* Automated IPFS Swarming
* Fast Replay
* Autonomous Multi-sig Account Management
* Accurate Tracking of collateralized safety margins
* Enforcement of safety margins
* Added a claim routine to ease tax reporting
* Half of claims locked in gov or power
* Opened NFT minting to all accounts
* Fixed DEX history
* Fixed DEX sell loop for expired trades
* Implemented multiple hive-js node selection
* Only Node operators can lock Gov 

### 1.1.3

* Remove stop callback for API failure. Rely on API Cycle only
* Remove ecency from API List
* Add release notes
