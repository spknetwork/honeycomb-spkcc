/**
 * Honeygraph WebSocket Integration
 * Simple module to initialize WebSocket streaming to Honeygraph
 */

const HoneygraphWSClient = require('./honeygraph-ws-client');

class HoneygraphWSIntegration {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      url: config.url || process.env.HONEYGRAPH_WS_URL || 'ws://localhost:4000/ws',
      token: config.token || process.env.TOKEN || 'DLUX',
      autoReconnect: config.autoReconnect !== false,
      batchSize: config.batchSize || 100,
      ...config
    };
    
    this.client = null;
    this.operationQueue = [];
    this.blockOperations = new Map(); // blockNum -> operations
    this.isProcessing = false;
    this.lastProcessedIndex = 0;
  }

  /**
   * Initialize WebSocket connection
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('[HoneygraphWS] Integration disabled');
      return;
    }

    console.log(`[HoneygraphWS] Initializing integration for token: ${this.config.token}`);
    
    this.client = new HoneygraphWSClient({
      url: this.config.url,
      token: this.config.token,
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      heartbeatInterval: 30000
    });

    // Setup event handlers
    this.setupEventHandlers();

    // Connect to Honeygraph
    try {
      await this.client.connect();
      console.log('[HoneygraphWS] Successfully connected to Honeygraph');
    } catch (error) {
      console.error('[HoneygraphWS] Failed to connect:', error);
      if (!this.config.autoReconnect) {
        throw error;
      }
    }
  }

  /**
   * Setup client event handlers
   * @private
   */
  setupEventHandlers() {
    this.client.on('connected', () => {
      console.log('[HoneygraphWS] Connected, processing queued operations');
      this.processQueue();
    });

    this.client.on('disconnected', ({ code, reason }) => {
      console.log(`[HoneygraphWS] Disconnected - Code: ${code}, Reason: ${reason}`);
    });

    this.client.on('request_missing', async ({ from, to }) => {
      console.log(`[HoneygraphWS] Honeygraph requesting missing operations ${from}-${to}`);
      await this.sendMissingOperations(from, to);
    });

    this.client.on('sync_status', ({ lastIndex }) => {
      console.log(`[HoneygraphWS] Honeygraph last index: ${lastIndex}`);
      if (lastIndex < this.lastProcessedIndex) {
        // Honeygraph is behind, it will request missing operations
        console.log(`[HoneygraphWS] Honeygraph is behind (${lastIndex} < ${this.lastProcessedIndex})`);
      }
    });

    this.client.on('error', (error) => {
      console.error('[HoneygraphWS] Client error:', error);
    });

    this.client.on('server_error', (error) => {
      console.error('[HoneygraphWS] Server error:', error);
    });
  }

  /**
   * Track operation from Block object
   * @param {Object} operation - Operation with index, blockNum, etc.
   */
  trackOperation(operation) {
    if (!this.config.enabled) return;

    // Ensure operation has required fields
    if (!operation.index || !operation.blockNum) {
      console.warn('[HoneygraphWS] Invalid operation, missing index or blockNum:', operation);
      return;
    }

    // Add to queue
    this.operationQueue.push(operation);
    
    // Track by block number for batch processing
    if (!this.blockOperations.has(operation.blockNum)) {
      this.blockOperations.set(operation.blockNum, []);
    }
    this.blockOperations.get(operation.blockNum).push(operation);

    // Update last processed index
    this.lastProcessedIndex = Math.max(this.lastProcessedIndex, operation.index);

    // Process queue if connected
    if (this.client && this.client.isConnected && !this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Send checkpoint when block is finalized
   * @param {Object} checkpoint - Checkpoint data with blockNum and hash
   */
  sendCheckpoint(checkpoint) {
    if (!this.config.enabled || !this.client || !this.client.isConnected) {
      return;
    }

    this.client.sendCheckpoint(checkpoint);
    
    // Clean up old block operations
    this.cleanupOldBlocks(checkpoint.blockNum);
  }

  /**
   * Process queued operations
   * @private
   */
  async processQueue() {
    if (this.isProcessing || !this.client || !this.client.isConnected || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.operationQueue.length > 0 && this.client.isConnected) {
        // Process in batches
        const batch = this.operationQueue.splice(0, this.config.batchSize);
        
        if (batch.length === 1) {
          // Send single operation
          this.client.sendOperation(batch[0]);
        } else {
          // Send batch
          this.client.sendBatch(batch);
        }

        // Small delay between batches
        if (this.operationQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    } catch (error) {
      console.error('[HoneygraphWS] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send missing operations to Honeygraph
   * @private
   */
  async sendMissingOperations(from, to) {
    const missing = [];
    
    // Collect operations from tracked blocks
    for (const [blockNum, operations] of this.blockOperations) {
      for (const op of operations) {
        if (op.index >= from && op.index <= to) {
          missing.push(op);
        }
      }
    }

    // Sort by index
    missing.sort((a, b) => a.index - b.index);

    if (missing.length > 0) {
      console.log(`[HoneygraphWS] Sending ${missing.length} missing operations`);
      this.client.sendBatch(missing);
    } else {
      console.warn(`[HoneygraphWS] No operations found for range ${from}-${to}`);
      // This might happen if operations were cleaned up
      // In production, you might want to fetch from Block object or database
    }
  }

  /**
   * Clean up old block operations to prevent memory leak
   * @private
   */
  cleanupOldBlocks(currentBlockNum) {
    const blocksToKeep = 100; // Keep last 100 blocks
    const cutoffBlock = currentBlockNum - blocksToKeep;
    
    for (const [blockNum] of this.blockOperations) {
      if (blockNum < cutoffBlock) {
        this.blockOperations.delete(blockNum);
      }
    }
  }

  /**
   * Hook into Block object to track operations
   * @param {Object} Block - The Block object from honeycomb
   */
  hookBlockObject(Block) {
    if (!this.config.enabled) return;

    console.log('[HoneygraphWS] Hooking into Block object');
    
    // Track when operations are added to Block.ops
    const originalPush = Block.ops.push;
    Block.ops.push = (...operations) => {
      const result = originalPush.apply(Block.ops, operations);
      
      // Track each operation
      for (const op of operations) {
        if (op && typeof op === 'object') {
          // Add index if not present (use array length as index)
          if (!op.index) {
            op.index = Block.ops.length;
          }
          this.trackOperation(op);
        }
      }
      
      return result;
    };

    // Also hook unshift if operations can be added at the beginning
    const originalUnshift = Block.ops.unshift;
    Block.ops.unshift = (...operations) => {
      const result = originalUnshift.apply(Block.ops, operations);
      
      // Re-index all operations
      Block.ops.forEach((op, index) => {
        if (op && typeof op === 'object') {
          op.index = index + 1;
        }
      });
      
      // Track new operations
      for (const op of operations) {
        if (op && typeof op === 'object') {
          this.trackOperation(op);
        }
      }
      
      return result;
    };
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      connected: this.client ? this.client.isConnected : false,
      token: this.config.token,
      queueLength: this.operationQueue.length,
      lastProcessedIndex: this.lastProcessedIndex,
      trackedBlocks: this.blockOperations.size
    };
  }

  /**
   * Shutdown integration
   */
  shutdown() {
    console.log('[HoneygraphWS] Shutting down integration');
    
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    
    this.operationQueue = [];
    this.blockOperations.clear();
  }
}

// Singleton instance
let instance = null;

/**
 * Initialize or get Honeygraph WebSocket integration
 * @param {Object} config - Configuration options
 * @returns {HoneygraphWSIntegration} Integration instance
 */
function getHoneygraphWSIntegration(config) {
  if (!instance) {
    instance = new HoneygraphWSIntegration(config);
  }
  return instance;
}

module.exports = {
  HoneygraphWSIntegration,
  getHoneygraphWSIntegration
};