import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class HoneygraphWebSocket extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      url: config.honeygraph?.url || 'ws://localhost:3030/ws',
      token: config.honeygraph?.token || 'spk',
      apiKey: config.honeygraph?.apiKey,
      reconnect: config.honeygraph?.reconnect !== false,
      reconnectInterval: config.honeygraph?.reconnectInterval || 5000,
      maxReconnectInterval: config.honeygraph?.maxReconnectInterval || 30000,
      batchSize: config.honeygraph?.batchSize || 100,
      flushInterval: config.honeygraph?.flushInterval || 1000
    };
    
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.operationQueue = [];
    this.batchTimer = null;
    this.lastIndex = -1;
    
    if (config.honeygraph?.enabled) {
      this.connect();
    }
  }
  
  connect() {
    const url = `${this.config.url}/${this.config.token}`;
    console.log(`Connecting to Honeygraph WebSocket at ${url}`);
    
    this.ws = new WebSocket(url, {
      headers: this.config.apiKey ? {
        'Authorization': `Bearer ${this.config.apiKey}`
      } : {}
    });
    
    this.ws.on('open', () => {
      console.log('Connected to Honeygraph WebSocket');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // Send subscription message
      this.send({
        type: 'subscribe',
        token: this.config.token,
        lastIndex: this.lastIndex
      });
      
      // Flush any queued operations
      this.flush();
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    });
    
    this.ws.on('close', () => {
      console.log('Disconnected from Honeygraph WebSocket');
      this.connected = false;
      this.emit('disconnected');
      
      if (this.config.reconnect) {
        this.scheduleReconnect();
      }
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
      this.emit('error', error);
    });
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'sync_status':
        this.lastIndex = message.lastIndex;
        console.log(`Honeygraph sync status: last index ${message.lastIndex}`);
        break;
        
      case 'request_missing':
        console.log(`Honeygraph requesting operations ${message.from} to ${message.to}`);
        this.emit('request_missing', message);
        break;
        
      case 'ack':
        this.emit('acknowledged', message.indexes);
        break;
        
      default:
        this.emit('message', message);
    }
  }
  
  scheduleReconnect() {
    const interval = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );
    
    console.log(`Reconnecting to Honeygraph in ${interval}ms...`);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, interval);
  }
  
  trackOperation(operation) {
    if (!this.config.url) return;
    
    // Update last index
    if (operation.index > this.lastIndex) {
      this.lastIndex = operation.index;
    }
    
    // Add to queue
    this.operationQueue.push(operation);
    
    // Batch operations
    if (this.operationQueue.length >= this.config.batchSize) {
      this.flush();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), this.config.flushInterval);
    }
  }
  
  flush() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.operationQueue.length === 0) return;
    
    const operations = this.operationQueue.splice(0, this.config.batchSize);
    
    if (this.connected) {
      this.send({
        type: 'operations_batch',
        operations
      });
    } else {
      // Re-queue if not connected
      this.operationQueue.unshift(...operations);
    }
  }
  
  send(message) {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  sendCheckpoint(blockNum, hash) {
    if (!this.config.url) return;
    
    this.send({
      type: 'checkpoint',
      blockNum,
      hash,
      lastOpIndex: this.lastIndex
    });
  }
  
  isConnected() {
    return this.connected;
  }
  
  close() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.config.reconnect = false;
    
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Factory function
export function createHoneygraphWebSocket(config) {
  return new HoneygraphWebSocket(config);
}