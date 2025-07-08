/**
 * DBInterceptor - Intercepts database operations and forwards them to Honeygraph
 * 
 * This class wraps a database instance and intercepts all write operations,
 * forwarding them to Honeygraph for indexing while ensuring the original
 * database operations complete successfully.
 */
export class DBInterceptor {
    constructor(db, honeygraphClient) {
        this.db = db;
        this.client = honeygraphClient;
        
        // Bind methods to preserve context
        this.put = this.put.bind(this);
        this.del = this.del.bind(this);
        this.batch = this.batch.bind(this);
        
        // Proxy read operations directly
        this.get = db.get ? db.get.bind(db) : undefined;
        this.createReadStream = db.createReadStream ? db.createReadStream.bind(db) : undefined;
    }

    /**
     * Intercept PUT operations
     * @param {string} key - The key to store
     * @param {*} value - The value to store
     * @param {object} options - Optional database options
     * @returns {Promise} - Resolves when database write completes
     */
    async put(key, value, options) {
        // Execute the actual database operation first
        const result = await this.db.put(key, value, options);
        
        // Forward to honeygraph asynchronously (don't block)
        if (this.client.isEnabled()) {
            this.client.addOperation({
                operation: 'put',
                key,
                value,
                timestamp: Date.now()
            }).catch(err => {
                // Log error but don't fail the operation
                console.error('Honeygraph forward failed:', err);
            });
        }
        
        return result;
    }

    /**
     * Intercept DEL operations
     * @param {string} key - The key to delete
     * @param {object} options - Optional database options
     * @returns {Promise} - Resolves when database delete completes
     */
    async del(key, options) {
        // Execute the actual database operation first
        const result = await this.db.del(key, options);
        
        // Forward to honeygraph asynchronously
        if (this.client.isEnabled()) {
            this.client.addOperation({
                operation: 'del',
                key,
                timestamp: Date.now()
            }).catch(err => {
                console.error('Honeygraph forward failed:', err);
            });
        }
        
        return result;
    }

    /**
     * Intercept BATCH operations
     * @param {Array} operations - Array of batch operations
     * @param {object} options - Optional database options
     * @returns {Promise} - Resolves when database batch completes
     */
    async batch(operations, options) {
        // Execute the actual database operation first
        const result = await this.db.batch(operations, options);
        
        // Forward to honeygraph asynchronously
        if (this.client.isEnabled()) {
            // Convert batch operations to honeygraph format
            const honeygraphOps = operations.map(op => ({
                operation: op.type,
                key: op.key,
                value: op.value,
                timestamp: Date.now()
            }));
            
            // Add all operations
            Promise.all(
                honeygraphOps.map(op => this.client.addOperation(op))
            ).catch(err => {
                console.error('Honeygraph batch forward failed:', err);
            });
        }
        
        return result;
    }

    /**
     * Get the underlying database instance
     * @returns {object} - The wrapped database
     */
    getDB() {
        return this.db;
    }

    /**
     * Get the honeygraph client
     * @returns {HoneygraphClient} - The honeygraph client
     */
    getClient() {
        return this.client;
    }

    /**
     * Create a wrapped database that intercepts operations
     * @param {object} db - The database to wrap
     * @param {HoneygraphClient} honeygraphClient - The honeygraph client
     * @returns {DBInterceptor} - The wrapped database
     */
    static wrap(db, honeygraphClient) {
        return new DBInterceptor(db, honeygraphClient);
    }
}

export default DBInterceptor;