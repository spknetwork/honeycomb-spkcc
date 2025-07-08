/**
 * Tests for HoneygraphWSClient
 */

const HoneygraphWSClient = require('../lib/honeygraph-ws-client');
const WebSocket = require('ws');
const assert = require('assert');

// Mock WebSocket server for testing
class MockWSServer {
  constructor(port = 4001) {
    this.port = port;
    this.server = null;
    this.clients = new Set();
  }

  async start() {
    this.server = new WebSocket.Server({ port: this.port });
    
    this.server.on('connection', (ws, req) => {
      this.clients.add(ws);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      });
      
      ws.on('close', () => {
        this.clients.delete(ws);
      });
      
      ws.on('pong', () => {
        // Handle pong
      });
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  handleMessage(ws, message) {
    switch (message.type) {
      case 'sync_status':
        ws.send(JSON.stringify({
          type: 'sync_status',
          lastIndex: 100
        }));
        break;
        
      case 'op':
        ws.send(JSON.stringify({
          type: 'ack',
          index: message.index,
          success: true
        }));
        break;
        
      case 'batch':
        ws.send(JSON.stringify({
          type: 'ack',
          success: true
        }));
        break;
    }
  }

  requestMissing(from, to) {
    for (const ws of this.clients) {
      ws.send(JSON.stringify({
        type: 'request_missing',
        from,
        to
      }));
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      for (const ws of this.clients) {
        ws.close();
      }
    }
  }
}

describe('HoneygraphWSClient', () => {
  let mockServer;
  let client;
  
  before(async () => {
    mockServer = new MockWSServer(4001);
    await mockServer.start();
  });
  
  after(() => {
    mockServer.stop();
  });
  
  beforeEach(() => {
    client = new HoneygraphWSClient({
      url: 'ws://localhost:4001/ws',
      reconnectInterval: 100,
      heartbeatInterval: 1000,
      token: 'TEST'
    });
  });
  
  afterEach(() => {
    client.disconnect();
  });
  
  describe('Connection', () => {
    it('should connect to WebSocket server', async () => {
      let connected = false;
      
      client.on('connected', () => {
        connected = true;
      });
      
      await client.connect();
      assert(connected, 'Should emit connected event');
      assert(client.isConnected, 'Should be connected');
    });
    
    it('should handle connection errors', async () => {
      const badClient = new HoneygraphWSClient({
        url: 'ws://localhost:9999/ws',
        reconnectInterval: 50
      });
      
      try {
        await badClient.connect();
      } catch (error) {
        // Expected
      }
      
      badClient.disconnect();
    });
    
    it('should reconnect on disconnect', (done) => {
      let reconnectCount = 0;
      
      client.on('connected', () => {
        reconnectCount++;
        
        if (reconnectCount === 1) {
          // Force disconnect
          client.ws.close();
        } else if (reconnectCount === 2) {
          // Reconnected successfully
          done();
        }
      });
      
      client.connect();
    });
  });
  
  describe('Operations', () => {
    beforeEach(async () => {
      await client.connect();
    });
    
    it('should send operations', (done) => {
      client.on('ack', (ack) => {
        assert.equal(ack.index, 123);
        assert(ack.success);
        done();
      });
      
      const success = client.sendOperation({
        index: 123,
        blockNum: 1000,
        checkpointHash: 'Qm123',
        type: 'set',
        path: 'user.alice.balance',
        data: { amount: 100 }
      });
      
      assert(success, 'Should send operation successfully');
      assert.equal(client.getLastSentIndex(), 123);
    });
    
    it('should send checkpoints', () => {
      const success = client.sendCheckpoint({
        blockNum: 1000,
        hash: 'QmCheckpoint123'
      });
      
      assert(success, 'Should send checkpoint successfully');
    });
    
    it('should send batch operations', (done) => {
      client.on('ack', (ack) => {
        assert(ack.success);
        done();
      });
      
      const operations = [
        {
          index: 100,
          blockNum: 1000,
          type: 'set',
          path: 'user.alice.balance',
          data: { amount: 100 }
        },
        {
          index: 101,
          blockNum: 1000,
          type: 'set',
          path: 'user.bob.balance',
          data: { amount: 200 }
        }
      ];
      
      const success = client.sendBatch(operations);
      assert(success, 'Should send batch successfully');
      assert.equal(client.getLastSentIndex(), 101);
    });
    
    it('should handle missing data requests', (done) => {
      client.on('request_missing', (request) => {
        assert.equal(request.from, 50);
        assert.equal(request.to, 100);
        done();
      });
      
      // Simulate server requesting missing data
      mockServer.requestMissing(50, 100);
    });
  });
  
  describe('Heartbeat', () => {
    it('should send ping messages', async () => {
      await client.connect();
      
      // Wait for heartbeat
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Should still be connected
      assert(client.isConnected);
    });
  });
  
  describe('Error handling', () => {
    beforeEach(async () => {
      await client.connect();
    });
    
    it('should handle server errors', (done) => {
      client.on('server_error', (error) => {
        assert.equal(error, 'Test error');
        done();
      });
      
      // Send error from server
      for (const ws of mockServer.clients) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Test error'
        }));
      }
    });
    
    it('should not send when disconnected', () => {
      client.disconnect();
      
      const success = client.sendOperation({
        index: 123,
        blockNum: 1000,
        type: 'set',
        path: 'test',
        data: {}
      });
      
      assert(!success, 'Should not send when disconnected');
    });
  });
});

// Run tests if called directly
if (require.main === module) {
  const { spawn } = require('child_process');
  const mocha = spawn('mocha', [__filename], { stdio: 'inherit' });
  
  mocha.on('close', (code) => {
    process.exit(code);
  });
}