import { createForkAwarePathwise } from '../pathwise-fork.js';
import { ipfsHash } from '../ipfsSaveState.js';

// Integration with index.mjs for fork-aware operations
export class ForkIntegration {
    constructor(store, honeygraphOptions = {}) {
        this.pathwise = createForkAwarePathwise(store._db, honeygraphOptions);
        this.store = store;
        this.lastCheckpoint = null;
        this.startHash = null;
        this.startBlock = null;
    }
    
    // Initialize fork manager with consensus start hash
    async initializeFromConsensus(startHash, startBlock) {
        console.log(`Initializing fork manager with consensus hash: ${startHash} at block ${startBlock}`);
        
        this.startHash = startHash;
        this.startBlock = startBlock;
        
        // Set the initial fork to the consensus hash
        this.pathwise.forkManager.setCurrentFork(startHash);
        
        // Create initial fork entry
        this.pathwise.forkManager.createFork(null, startBlock, startHash);
        
        // If honeygraph is enabled, sync the initial state
        if (this.pathwise.honeygraph) {
            try {
                await this.pathwise.honeygraph.createCheckpoint({
                    blockNum: startBlock,
                    blockHash: startHash,
                    forkId: startHash,
                    stateHash: startHash
                });
                console.log(`Synced initial checkpoint to honeygraph: ${startHash}`);
            } catch (err) {
                console.error('Failed to sync initial checkpoint:', err);
            }
        }
        
        return {
            startHash,
            startBlock,
            forkId: startHash
        };
    }

    // Process block with fork awareness
    async processBlock(blockNum, blockState, blockHash) {
        // Generate IPFS hash synchronously
        const ipfsHash = await ipfsHash(blockState, blockNum);
        
        // Set current fork if not set
        if (!this.pathwise.forkManager.getCurrentFork()) {
            this.pathwise.forkManager.setCurrentFork(ipfsHash);
        }
        
        // Check if this is a new fork
        const expectedFork = this.pathwise.forkManager.getCurrentFork();
        if (ipfsHash !== expectedFork && blockNum > 1) {
            // Fork detected
            console.log(`Fork detected at block ${blockNum}: expected ${expectedFork}, got ${ipfsHash}`);
            this.pathwise.forkManager.createFork(expectedFork, blockNum, ipfsHash);
            this.pathwise.forkManager.switchFork(ipfsHash);
        }
        
        return {
            ipfsHash,
            forkId: ipfsHash,
            isNewFork: ipfsHash !== expectedFork
        };
    }

    // Create checkpoint at LIB
    async createCheckpoint(blockNum, ipfsHash, blockHash, batch) {
        return new Promise((resolve, reject) => {
            this.pathwise.createCheckpoint(blockNum, ipfsHash, blockHash, { batch }, (err) => {
                if (err) reject(err);
                else {
                    this.lastCheckpoint = { blockNum, ipfsHash, blockHash };
                    resolve();
                }
            });
        });
    }

    // Handle consensus update
    async handleConsensus(consensusData) {
        if (this.pathwise.honeygraph) {
            return this.pathwise.updateConsensus(consensusData);
        }
        
        // Local consensus handling
        const currentFork = this.pathwise.forkManager.getCurrentFork();
        if (consensusData.consensusHash !== currentFork) {
            console.log(`Local fork mismatch: on ${currentFork}, consensus on ${consensusData.consensusHash}`);
            // In production, this would trigger a resync
        }
    }

    // Batch operations with fork metadata
    batchWithFork(ops, pc, blockInfo) {
        return this.pathwise.batch(ops, pc, blockInfo);
    }

    // Get fork information
    getForkInfo() {
        return {
            current: this.pathwise.forkManager.getCurrentFork(),
            forks: Array.from(this.pathwise.forkManager.forks.entries()),
            history: this.pathwise.forkManager.forkHistory,
            lastCheckpoint: this.lastCheckpoint
        };
    }

    // Revert to specific fork/checkpoint
    async revertToFork(ipfsHash, blockNum) {
        const currentFork = this.pathwise.forkManager.getCurrentFork();
        if (currentFork === ipfsHash) {
            console.log('Already on target fork');
            return;
        }

        // Mark current fork as orphaned
        this.pathwise.forkManager.markOrphaned(currentFork);
        
        // Switch to target fork
        this.pathwise.forkManager.switchFork(ipfsHash);
        
        // Revert operations
        await this.pathwise.revertFork(currentFork, blockNum);
        
        console.log(`Reverted from ${currentFork} to ${ipfsHash} at block ${blockNum}`);
    }
}

// Factory function
export function createForkIntegration(store, honeygraphOptions) {
    return new ForkIntegration(store, honeygraphOptions);
}