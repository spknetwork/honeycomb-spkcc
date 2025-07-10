/**
 * WebSocket Client for streaming operations to Honeygraph
 * Tracks operation indexes from Block object and handles reconnection
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

class HoneygraphWSClient extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      url: config.url || 'ws://localhost:4000/ws',
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectInterval: config.maxReconnectInterval || 30000,
      reconnectDecay: config.reconnectDecay || 1.5,
      heartbeatInterval: config.heartbeatInterval || 30000,
      requestTimeout: config.requestTimeout || 10000,
      token: config.token || 'DLUX',
      ...config
    };
    
    this.ws = null;
    this.reconnectAttempts = 0;
    this.currentReconnectInterval = this.config.reconnectInterval;
    this.heartbeatTimer = null;
    this.pendingRequests = new Map();
    this.lastSentIndex = 0;
    this.isConnected = false;
    this.shouldReconnect = true;
  }

  /**
   * Connect to Honeygraph WebSocket server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.config.url;
        console.log(`[HoneygraphWS] Connecting to ${wsUrl}`);
        
        this.ws = new WebSocket(wsUrl, {
          headers: {
            'X-Token': this.config.token,
            'X-Client-Type': 'honeycomb'
          }
        });

        this.ws.on('open', () => {
          console.log('[HoneygraphWS] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.currentReconnectInterval = this.config.reconnectInterval;
          
          // Send identify message
          this.send({
            type: 'identify',
            source: 'honeycomb-spkcc',
            version: '1.0.0',
            token: this.config.token
          });
          
          // Send sync status
          this.sendMessage({
            type: 'sync_status',
            lastIndex: this.lastSentIndex,
            token: this.config.token
          });
          
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[HoneygraphWS] Error parsing message:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[HoneygraphWS] WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[HoneygraphWS] Disconnected - Code: ${code}, Reason: ${reason}`);
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason });
          
          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('pong', () => {
          this.emit('pong');
        });

      } catch (error) {
        console.error('[HoneygraphWS] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.pendingRequests.clear();
  }

  /**
   * Send operation to Honeygraph
   * @param {Object} operation - Operation data with index, blockNum, etc.
   */
  sendOperation(operation) {
    if (!this.isConnected) {
      console.warn('[HoneygraphWS] Not connected, queuing operation');
      return false;
    }

    // Just send the raw operation data
    this.sendMessage(operation);
    this.lastSentIndex = operation.index;
    return true;
  }

  /**
   * Send checkpoint to Honeygraph
   * @param {Object} checkpoint - Checkpoint data
   */
  sendCheckpoint(checkpoint) {
    if (!this.isConnected) {
      console.warn('[HoneygraphWS] Not connected, cannot send checkpoint');
      return false;
    }

    const message = {
      type: 'checkpoint',
      blockNum: checkpoint.blockNum,
      hash: checkpoint.hash,
      timestamp: Date.now(),
      token: this.config.token
    };

    this.sendMessage(message);
    return true;
  }

  /**
   * Send batch of operations (for catch-up)
   * @param {Array} operations - Array of operations
   */
  sendBatch(operations) {
    if (!this.isConnected || !operations.length) {
      return false;
    }

    const message = {
      type: 'batch',
      operations: operations.map(op => ({
        index: op.index,
        blockNum: op.blockNum,
        checkpointHash: op.checkpointHash,
        opType: op.type,
        path: op.path,
        data: op.data,
        timestamp: op.timestamp
      })),
      token: this.config.token
    };

    this.sendMessage(message);
    
    if (operations.length > 0) {
      this.lastSentIndex = Math.max(...operations.map(op => op.index));
    }
    
    return true;
  }

  /**
   * Handle incoming messages
   * @private
   */
  handleMessage(message) {
    switch (message.type) {
      case 'request_missing':
        this.emit('request_missing', {
          from: message.from,
          to: message.to
        });
        break;
        
      case 'sync_status':
        this.emit('sync_status', {
          lastIndex: message.lastIndex
        });
        break;
        
      case 'ack':
        this.emit('ack', {
          index: message.index,
          success: message.success
        });
        break;
        
      case 'error':
        console.error('[HoneygraphWS] Server error:', message.error);
        this.emit('server_error', message.error);
        break;
        
      case 'pong':
        // Handled by WebSocket pong event
        break;
        
      default:
        console.warn('[HoneygraphWS] Unknown message type:', message.type);
    }
  }

  /**
   * Send message to server
   * @private
   */
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[HoneygraphWS] Cannot send message, not connected');
    }
  }

  /**
   * Start heartbeat
   * @private
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   * @private
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * @private
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    
    setTimeout(() => {
      if (this.shouldReconnect) {
        console.log(`[HoneygraphWS] Reconnection attempt ${this.reconnectAttempts}`);
        this.connect().catch(error => {
          console.error('[HoneygraphWS] Reconnection failed:', error);
        });
      }
    }, this.currentReconnectInterval);
    
    // Exponential backoff
    this.currentReconnectInterval = Math.min(
      this.currentReconnectInterval * this.config.reconnectDecay,
      this.config.maxReconnectInterval
    );
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get last sent index
   */
  getLastSentIndex() {
    return this.lastSentIndex;
  }
}

export default HoneygraphWSClient;