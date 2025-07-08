import axios from 'axios';
import { EventEmitter } from 'events';

/**
 * HoneygraphClient - Client for sending database operations and checkpoints to Honeygraph
 * 
 * Features:
 * - Batches operations for efficient network usage
 * - Handles retries with exponential backoff
 * - Non-blocking operation to avoid impacting consensus
 * - Supports multi-token namespacing
 * - Tracks fork information
 */
export class HoneygraphClient extends EventEmitter {
    constructor(config) {
        super();
        
        // Validate configuration
        this.validateConfig(config);
        
        // Set configuration with defaults
        this.config = {
            enabled: config.enabled || false,
            url: config.url,
            apiKey: config.apiKey,
            token: config.token,
            batchSize: config.batchSize || 100,
            flushInterval: config.flushInterval || 1000,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            timeout: config.timeout || 30000
        };
        
        // Internal state
        this.queue = [];
        this.forkId = null;
        this.flushTimer = null;
        this.isShuttingDown = false;
        this.activeFlush = null;
        
        // Create axios instance with defaults
        this.axios = axios.create({
            baseURL: this.config.url,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.config.apiKey
            }
        });
        
        // Start flush timer if enabled
        if (this.config.enabled) {
            this.startFlushTimer();
        }
    }

    /**
     * Validate required configuration fields
     */
    validateConfig(config) {
        if (!config) {
            throw new Error('Missing required configuration');
        }
        
        if (config.enabled !== false) {
            const required = ['url', 'apiKey', 'token'];
            for (const field of required) {
                if (!config[field]) {
                    throw new Error(`Missing required configuration field: ${field}`);
                }
            }
        }
    }

    /**
     * Check if client is enabled
     */
    isEnabled() {
        return this.config.enabled && !this.isShuttingDown;
    }

    /**
     * Add an operation to the queue
     * @param {object} operation - The operation to queue
     */
    async addOperation(operation) {
        if (!this.isEnabled()) {
            return;
        }
        
        // Add token and fork information
        const enrichedOp = {
            ...operation,
            token: this.config.token,
            forkId: this.forkId
        };
        
        this.queue.push(enrichedOp);
        
        // Check if we should flush immediately
        if (this.queue.length >= this.config.batchSize) {
            await this.flush();
        }
    }

    /**
     * Send a checkpoint hash to honeygraph
     * @param {number} blockNum - The block number
     * @param {string} hash - The checkpoint hash
     * @param {string} forkId - Optional fork identifier
     */
    async sendCheckpoint(blockNum, hash, forkId = null) {
        if (!this.isEnabled()) {
            return;
        }
        
        const checkpoint = {
            blockNum,
            hash,
            token: this.config.token,
            forkId: forkId || this.forkId,
            timestamp: Date.now()
        };
        
        try {
            await this.sendWithRetry('/checkpoint', checkpoint);
            this.emit('checkpoint-sent', checkpoint);
        } catch (error) {
            this.emit('checkpoint-error', { checkpoint, error });
            throw error;
        }
    }

    /**
     * Flush all queued operations to honeygraph
     */
    async flush() {
        if (!this.isEnabled() || this.queue.length === 0) {
            return;
        }
        
        // If a flush is already in progress, wait for it
        if (this.activeFlush) {
            return this.activeFlush;
        }
        
        // Reset timer
        this.resetFlushTimer();
        
        // Get operations to send
        const operations = this.queue.splice(0, this.config.batchSize);
        
        if (operations.length === 0) {
            return;
        }
        
        const payload = {
            operations,
            token: this.config.token,
            forkId: this.forkId
        };
        
        // Set active flush promise
        this.activeFlush = this.sendWithRetry('/writes', payload)
            .then(() => {
                this.emit('flush-complete', { count: operations.length });
            })
            .catch(error => {
                // Re-queue failed operations
                this.queue.unshift(...operations);
                this.emit('flush-error', { error, count: operations.length });
                throw error;
            })
            .finally(() => {
                this.activeFlush = null;
            });
        
        return this.activeFlush;
    }

    /**
     * Send data with retry logic
     * @param {string} endpoint - The API endpoint
     * @param {object} data - The data to send
     */
    async sendWithRetry(endpoint, data) {
        let lastError;
        
        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                const response = await this.axios.post(endpoint, data);
                return response.data;
            } catch (error) {
                lastError = error;
                
                // Don't retry on client errors (4xx)
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    throw error;
                }
                
                // Calculate delay with exponential backoff
                const delay = this.config.retryDelay * Math.pow(2, attempt);
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    /**
     * Set the current fork ID
     * @param {string} forkId - The fork identifier
     */
    setForkId(forkId) {
        this.forkId = forkId;
        this.emit('fork-changed', forkId);
    }

    /**
     * Clear the fork ID (fork resolved)
     */
    clearForkId() {
        this.forkId = null;
        this.emit('fork-resolved');
    }

    /**
     * Subscribe to LIB updates from honeycomb
     * @param {EventEmitter} libEmitter - The LIB event emitter
     */
    subscribeLIBUpdates(libEmitter) {
        libEmitter.on('lib-updated', async (data) => {
            try {
                await this.sendCheckpoint(data.blockNum, data.hash, data.forkId);
            } catch (error) {
                console.error('Failed to send LIB checkpoint:', error);
            }
        });
    }

    /**
     * Start the flush timer
     */
    startFlushTimer() {
        if (this.flushTimer) {
            return;
        }
        
        this.flushTimer = setInterval(() => {
            this.flush().catch(err => {
                console.error('Auto-flush failed:', err);
            });
        }, this.config.flushInterval);
    }

    /**
     * Reset the flush timer
     */
    resetFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        
        if (this.isEnabled()) {
            this.startFlushTimer();
        }
    }

    /**
     * Shutdown the client gracefully
     */
    async shutdown() {
        this.isShuttingDown = true;
        
        // Stop timer
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        
        // Final flush
        try {
            await this.flush();
        } catch (error) {
            console.error('Final flush failed:', error);
        }
        
        this.emit('shutdown');
    }

    /**
     * Get queue statistics
     */
    getStats() {
        return {
            queueLength: this.queue.length,
            isEnabled: this.isEnabled(),
            forkId: this.forkId,
            config: {
                url: this.config.url,
                token: this.config.token,
                batchSize: this.config.batchSize,
                flushInterval: this.config.flushInterval
            }
        };
    }
}

export default HoneygraphClient;