/**
 * Honeygraph initialization module for honeycomb-spkcc
 * 
 * This module provides the integration between honeycomb's database
 * and the Honeygraph indexing service.
 */

import HoneygraphClient from './honeygraph-client.js';
import DBInterceptor from './db-interceptor.js';
import { EventEmitter } from 'events';

// Event emitter for LIB updates
export const libEmitter = new EventEmitter();

// Global honeygraph client instance
let honeygraphClient = null;

/**
 * Initialize honeygraph integration with the database
 * 
 * @param {object} db - The level database instance
 * @param {object} config - The application configuration
 * @returns {object} - The wrapped database instance
 */
export function initHoneygraph(db, config) {
    // Check if honeygraph is configured and enabled
    if (!config.honeygraph || !config.honeygraph.enabled) {
        console.log('Honeygraph integration: disabled');
        return db;
    }

    try {
        // Create honeygraph client
        honeygraphClient = new HoneygraphClient(config.honeygraph);
        
        // Set up event handlers
        honeygraphClient.on('flush-complete', ({ count }) => {
            if (config.honeygraph.verbose) {
                console.log(`Honeygraph: Flushed ${count} operations`);
            }
        });

        honeygraphClient.on('flush-error', ({ error, count }) => {
            console.error(`Honeygraph: Failed to flush ${count} operations:`, error.message);
        });

        honeygraphClient.on('checkpoint-sent', (checkpoint) => {
            console.log(`Honeygraph: Checkpoint sent for block ${checkpoint.blockNum}`);
        });

        honeygraphClient.on('checkpoint-error', ({ checkpoint, error }) => {
            console.error(`Honeygraph: Failed to send checkpoint for block ${checkpoint.blockNum}:`, error.message);
        });

        // Subscribe to LIB updates
        honeygraphClient.subscribeLIBUpdates(libEmitter);

        // Wrap the database
        const wrappedDB = DBInterceptor.wrap(db, honeygraphClient);

        // Set up graceful shutdown
        process.on('SIGTERM', shutdownHoneygraph);
        process.on('SIGINT', shutdownHoneygraph);

        console.log(`Honeygraph integration: enabled (${config.honeygraph.url})`);
        console.log(`Honeygraph token: ${config.honeygraph.token}`);
        console.log(`Honeygraph batch size: ${config.honeygraph.batchSize}`);
        console.log(`Honeygraph flush interval: ${config.honeygraph.flushInterval}ms`);

        return wrappedDB;
    } catch (error) {
        console.error('Failed to initialize Honeygraph:', error.message);
        console.error('Continuing without Honeygraph integration');
        return db;
    }
}

/**
 * Update honeygraph with new LIB information
 * 
 * @param {number} blockNum - The block number
 * @param {string} hash - The block hash
 * @param {string} forkId - Optional fork identifier
 */
export function updateLIB(blockNum, hash, forkId = null) {
    libEmitter.emit('lib-updated', {
        blockNum,
        hash,
        forkId
    });
}

/**
 * Set fork ID for all future operations
 * 
 * @param {string} forkId - The fork identifier
 */
export function setForkId(forkId) {
    if (honeygraphClient) {
        honeygraphClient.setForkId(forkId);
    }
}

/**
 * Clear fork ID (fork resolved)
 */
export function clearForkId() {
    if (honeygraphClient) {
        honeygraphClient.clearForkId();
    }
}

/**
 * Get honeygraph statistics
 * 
 * @returns {object} - Statistics object
 */
export function getHoneygraphStats() {
    if (honeygraphClient) {
        return honeygraphClient.getStats();
    }
    return null;
}

/**
 * Graceful shutdown handler
 */
async function shutdownHoneygraph() {
    if (honeygraphClient) {
        console.log('Shutting down Honeygraph client...');
        try {
            await honeygraphClient.shutdown();
            console.log('Honeygraph client shutdown complete');
        } catch (error) {
            console.error('Error during Honeygraph shutdown:', error);
        }
    }
}

/**
 * Get the honeygraph client instance
 * 
 * @returns {HoneygraphClient|null} - The client instance or null
 */
export function getHoneygraphClient() {
    return honeygraphClient;
}

// Default export with all functions
export default {
    initHoneygraph,
    updateLIB,
    setForkId,
    clearForkId,
    getHoneygraphStats,
    getHoneygraphClient,
    libEmitter
};