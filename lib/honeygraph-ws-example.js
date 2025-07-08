/**
 * Example integration of Honeygraph WebSocket streaming
 * This shows how to integrate with your existing honeycomb node
 */

const { getHoneygraphWSIntegration } = require('./honeygraph-ws-init');

// Example of how to integrate with your Block object
async function integrateHoneygraph(config = {}) {
  // Initialize the WebSocket integration
  const integration = getHoneygraphWSIntegration({
    enabled: true,
    url: config.honeygraphUrl || 'ws://localhost:4000/ws',
    token: config.token || 'DLUX',
    autoReconnect: true,
    batchSize: 100
  });

  try {
    // Connect to Honeygraph
    await integration.initialize();
    
    console.log('[Honeygraph] Integration initialized');
    
    // Example: Hook into your existing Block object
    // This assumes you have a global Block object
    if (typeof block !== 'undefined' && block.ops) {
      integration.hookBlockObject(block);
      console.log('[Honeygraph] Hooked into Block object');
    }
    
    // Example: Manually track an operation
    // This is what gets called automatically when using hookBlockObject
    integration.trackOperation({
      index: 1,
      blockNum: 1000,
      checkpointHash: 'QmExampleHash',
      type: 'set',
      path: 'users.alice.balance',
      data: {
        amount: 100,
        currency: 'DLUX'
      },
      timestamp: Date.now()
    });
    
    // Example: Send a checkpoint when a block is finalized
    integration.sendCheckpoint({
      blockNum: 1000,
      hash: 'QmCheckpointHash123'
    });
    
    // Example: Get status
    const status = integration.getStatus();
    console.log('[Honeygraph] Status:', status);
    
    return integration;
    
  } catch (error) {
    console.error('[Honeygraph] Failed to initialize:', error);
    throw error;
  }
}

// Example of manual operation tracking (without Block object)
class ManualOperationTracker {
  constructor(integration) {
    this.integration = integration;
    this.operationIndex = 0;
  }
  
  trackSet(path, data, blockNum, checkpointHash) {
    this.operationIndex++;
    
    this.integration.trackOperation({
      index: this.operationIndex,
      blockNum,
      checkpointHash,
      type: 'set',
      path,
      data,
      timestamp: Date.now()
    });
  }
  
  trackDelete(path, blockNum, checkpointHash) {
    this.operationIndex++;
    
    this.integration.trackOperation({
      index: this.operationIndex,
      blockNum,
      checkpointHash,
      type: 'delete',
      path,
      data: null,
      timestamp: Date.now()
    });
  }
  
  trackUpdate(path, updates, blockNum, checkpointHash) {
    this.operationIndex++;
    
    this.integration.trackOperation({
      index: this.operationIndex,
      blockNum,
      checkpointHash,
      type: 'update',
      path,
      data: updates,
      timestamp: Date.now()
    });
  }
}

// Example usage in your honeycomb node initialization
async function exampleNodeInit() {
  // Your existing node initialization...
  
  // Add Honeygraph integration
  try {
    const honeygraphIntegration = await integrateHoneygraph({
      honeygraphUrl: process.env.HONEYGRAPH_WS_URL || 'ws://localhost:4000/ws',
      token: process.env.TOKEN || 'DLUX'
    });
    
    // Use manual tracker if needed
    const tracker = new ManualOperationTracker(honeygraphIntegration);
    
    // Example operations
    tracker.trackSet('users.bob.profile', { name: 'Bob', avatar: 'ipfs://...' }, 1001, 'Qm...');
    tracker.trackUpdate('users.bob.balance', { amount: 50 }, 1001, 'Qm...');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('[Honeygraph] Shutting down integration...');
      honeygraphIntegration.shutdown();
    });
    
  } catch (error) {
    console.error('[Honeygraph] Integration failed:', error);
    // Continue running without honeygraph
  }
}

module.exports = {
  integrateHoneygraph,
  ManualOperationTracker
};