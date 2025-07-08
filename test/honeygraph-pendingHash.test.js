const test = require('tape');
const HoneygraphIntegration = require('../lib/honeygraph-pendingHash-integration');
const EventEmitter = require('events');

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sentMessages = [];
    
    // Simulate connection after a tick
    process.nextTick(() => {
      this.readyState = 1; // OPEN
      this.emit('open');
    });
  }
  
  send(data) {
    if (this.readyState !== 1) throw new Error('WebSocket not open');
    this.sentMessages.push(JSON.parse(data));
  }
  
  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }
}

// Mock store
class MockStore {
  constructor() {
    this.operations = [];
    this.batch = this.originalBatch.bind(this);
  }
  
  async originalBatch(ops) {
    this.operations.push(...ops);
    return true;
  }
}

// Mock processor
class MockProcessor {
  constructor() {
    this.processor = {
      Block: {
        num: 1000,
        ops: 0
      }
    };
  }
}

test('HoneygraphIntegration - initialization', async (t) => {
  const integration = new HoneygraphIntegration({ enabled: false });
  const store = new MockStore();
  const processor = new MockProcessor();
  
  integration.init(store, processor);
  
  t.equal(integration.store, store, 'Store should be set');
  t.equal(integration.processor, processor, 'Processor should be set');
  t.equal(store.batch, store.originalBatch, 'Batch method should not be hooked when disabled');
  
  t.end();
});

test('HoneygraphIntegration - pendingHash detection', async (t) => {
  // Replace WebSocket with mock
  const originalWS = global.WebSocket;
  global.WebSocket = MockWebSocket;
  
  const integration = new HoneygraphIntegration({ 
    enabled: true,
    wsUrl: 'ws://test:3001/fork-stream'
  });
  
  const store = new MockStore();
  const processor = new MockProcessor();
  
  integration.init(store, processor);
  
  // Wait for connection
  await new Promise(resolve => integration.once('connected', resolve));
  
  // Simulate pendingHash write
  const operations = [
    { type: 'put', key: 'pendingHash', value: 'hash123' },
    { type: 'put', key: 'users:alice', value: { balance: 100 } },
    { type: 'del', key: 'temp:data' }
  ];
  
  await store.batch(operations);
  
  // Check sent messages
  const ws = integration.ws;
  const messages = ws.sentMessages;
  
  // Should have identify + fork_start + 3 operations
  t.equal(messages.length, 5, 'Should send 5 messages');
  
  t.equal(messages[0].type, 'identify', 'First message should be identify');
  t.equal(messages[1].type, 'fork_start', 'Second message should be fork_start');
  t.equal(messages[1].forkHash, 'hash123', 'Fork hash should match');
  t.equal(messages[1].blockNum, 1000, 'Block number should match');
  
  // Check operations have fork context
  t.equal(messages[2].type, 'put', 'Third message should be put operation');
  t.equal(messages[2].key, 'pendingHash', 'Key should match');
  t.equal(messages[2].forkHash, 'hash123', 'Operation should have fork hash');
  t.equal(messages[2].index, 0, 'First operation should have index 0');
  
  t.equal(messages[3].key, 'users:alice', 'Fourth message key should match');
  t.equal(messages[3].index, 1, 'Second operation should have index 1');
  
  t.equal(messages[4].type, 'del', 'Fifth message should be del operation');
  t.equal(messages[4].index, 2, 'Third operation should have index 2');
  
  // Check store operations were executed
  t.equal(store.operations.length, 3, 'Store should have all operations');
  
  integration.disconnect();
  global.WebSocket = originalWS;
  t.end();
});

test('HoneygraphIntegration - fork detection', async (t) => {
  const originalWS = global.WebSocket;
  global.WebSocket = MockWebSocket;
  
  const integration = new HoneygraphIntegration({ enabled: true });
  const store = new MockStore();
  const processor = new MockProcessor();
  
  integration.init(store, processor);
  
  await new Promise(resolve => integration.once('connected', resolve));
  
  // First block
  await store.batch([
    { type: 'put', key: 'pendingHash', value: 'hash1' }
  ]);
  
  // Clear sent messages
  integration.ws.sentMessages = [];
  
  // Second block with different hash (fork)
  processor.processor.Block.num = 1001;
  await store.batch([
    { type: 'put', key: 'pendingHash', value: 'hash2' }
  ]);
  
  const messages = integration.ws.sentMessages;
  
  // Should have fork_detected + fork_start + pendingHash operation
  t.equal(messages.length, 3, 'Should send 3 messages for fork');
  
  t.equal(messages[0].type, 'fork_detected', 'Should detect fork');
  t.equal(messages[0].oldForkHash, 'hash1', 'Old hash should match');
  t.equal(messages[0].newForkHash, 'hash2', 'New hash should match');
  
  t.equal(messages[1].type, 'fork_start', 'Should start new fork');
  t.equal(messages[1].forkHash, 'hash2', 'New fork hash should match');
  
  integration.disconnect();
  global.WebSocket = originalWS;
  t.end();
});

test('HoneygraphIntegration - checkpoint notification', async (t) => {
  const originalWS = global.WebSocket;
  global.WebSocket = MockWebSocket;
  
  const integration = new HoneygraphIntegration({ enabled: true });
  const store = new MockStore();
  const processor = new MockProcessor();
  
  integration.init(store, processor);
  
  await new Promise(resolve => integration.once('connected', resolve));
  
  // Set up a fork
  await store.batch([
    { type: 'put', key: 'pendingHash', value: 'expectedHash' }
  ]);
  
  // Clear messages
  integration.ws.sentMessages = [];
  
  // Notify checkpoint with matching hash
  integration.notifyCheckpoint(1100, 'expectedHash');
  
  const messages = integration.ws.sentMessages;
  t.equal(messages.length, 1, 'Should send checkpoint message');
  t.equal(messages[0].type, 'checkpoint', 'Should be checkpoint type');
  t.equal(messages[0].matches, true, 'Should indicate hash matches');
  t.equal(messages[0].blockNum, 1100, 'Block number should match');
  
  // Notify checkpoint with mismatched hash
  integration.notifyCheckpoint(1101, 'differentHash');
  
  t.equal(messages.length, 2, 'Should send another checkpoint message');
  t.equal(messages[1].matches, false, 'Should indicate hash mismatch');
  
  integration.disconnect();
  global.WebSocket = originalWS;
  t.end();
});

test('HoneygraphIntegration - operation queuing', async (t) => {
  const originalWS = global.WebSocket;
  
  // Mock WebSocket that doesn't connect immediately
  class DelayedMockWebSocket extends MockWebSocket {
    constructor(url) {
      super(url);
      this.readyState = 0;
      // Don't auto-connect
    }
    
    connect() {
      this.readyState = 1;
      this.emit('open');
    }
  }
  
  global.WebSocket = DelayedMockWebSocket;
  
  const integration = new HoneygraphIntegration({ enabled: true });
  const store = new MockStore();
  const processor = new MockProcessor();
  
  integration.init(store, processor);
  
  // Operations while disconnected should be queued
  await store.batch([
    { type: 'put', key: 'pendingHash', value: 'queuedHash' },
    { type: 'put', key: 'data', value: 'test' }
  ]);
  
  t.equal(integration.operationQueue.length, 3, 'Should queue 3 operations (fork_start + 2 ops)');
  
  // Connect WebSocket
  integration.ws.connect();
  
  // Wait a tick for event processing
  await new Promise(resolve => setImmediate(resolve));
  
  // Queue should be flushed
  t.equal(integration.operationQueue.length, 0, 'Queue should be empty after connection');
  t.equal(integration.ws.sentMessages.length, 4, 'Should send identify + 3 queued operations');
  
  integration.disconnect();
  global.WebSocket = originalWS;
  t.end();
});

test('HoneygraphIntegration - stats', async (t) => {
  const integration = new HoneygraphIntegration({ enabled: false });
  
  const stats = integration.getStats();
  
  t.equal(stats.connected, false, 'Should not be connected');
  t.equal(stats.currentForkHash, null, 'Should have no fork hash');
  t.equal(stats.queueLength, 0, 'Queue should be empty');
  
  t.end();
});

test('HoneygraphIntegration - reconnection', async (t) => {
  const originalWS = global.WebSocket;
  global.WebSocket = MockWebSocket;
  
  const integration = new HoneygraphIntegration({ 
    enabled: true,
    reconnectDelay: 100 // Fast reconnect for testing
  });
  
  const store = new MockStore();
  integration.init(store, new MockProcessor());
  
  await new Promise(resolve => integration.once('connected', resolve));
  
  // Simulate disconnect
  integration.ws.close();
  
  await new Promise(resolve => integration.once('disconnected', resolve));
  
  t.equal(integration.isConnected, false, 'Should be disconnected');
  
  // Wait for reconnection
  await new Promise(resolve => integration.once('connected', resolve));
  
  t.equal(integration.isConnected, true, 'Should reconnect');
  t.equal(integration.reconnectAttempts, 0, 'Reconnect attempts should reset');
  
  integration.disconnect();
  global.WebSocket = originalWS;
  t.end();
});

// Run tests
if (require.main === module) {
  test.onFinish(() => {
    process.exit(0);
  });
}