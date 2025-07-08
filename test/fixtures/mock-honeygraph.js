import express from 'express';
import bodyParser from 'body-parser';

export class MockHoneygraph {
    constructor() {
        this.app = express();
        this.server = null;
        this.writes = [];
        this.checkpoints = [];
        this.requests = [];
        this.failureMode = false;
        this.delay = 0;
        this.validApiKey = null;
        this.requestCount = 0;

        this.setupRoutes();
    }

    setupRoutes() {
        // Middleware
        this.app.use(bodyParser.json());
        
        // Track all requests
        this.app.use((req, res, next) => {
            this.requestCount++;
            this.requests.push({
                method: req.method,
                path: req.path,
                headers: req.headers,
                body: req.body,
                timestamp: Date.now()
            });

            // Simulate delay
            if (this.delay > 0) {
                setTimeout(() => next(), this.delay);
            } else {
                next();
            }
        });

        // API key validation
        this.app.use((req, res, next) => {
            if (this.validApiKey) {
                const apiKey = req.headers['x-api-key'];
                if (apiKey !== this.validApiKey) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
            }
            next();
        });

        // Failure simulation
        this.app.use((req, res, next) => {
            if (this.failureMode) {
                return res.status(503).json({ error: 'Service unavailable' });
            }
            next();
        });

        // POST /writes - Batch write operations
        this.app.post('/writes', (req, res) => {
            const { operations, token, forkId } = req.body;

            if (!operations || !Array.isArray(operations)) {
                return res.status(400).json({ error: 'Invalid operations' });
            }

            operations.forEach(op => {
                this.writes.push({
                    ...op,
                    token,
                    forkId,
                    timestamp: Date.now()
                });
            });

            res.json({ 
                success: true, 
                received: operations.length,
                total: this.writes.length 
            });
        });

        // POST /checkpoint - Submit checkpoint hash
        this.app.post('/checkpoint', (req, res) => {
            const { blockNum, hash, token, forkId } = req.body;

            if (!blockNum || !hash || !token) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const checkpoint = {
                blockNum,
                hash,
                token,
                forkId,
                timestamp: Date.now()
            };

            this.checkpoints.push(checkpoint);

            res.json({ 
                success: true,
                checkpoint 
            });
        });

        // GET /status - Health check
        this.app.get('/status', (req, res) => {
            res.json({
                status: 'ok',
                writes: this.writes.length,
                checkpoints: this.checkpoints.length,
                uptime: process.uptime()
            });
        });

        // GET /writes - Get all writes (for testing)
        this.app.get('/writes', (req, res) => {
            const { token, limit = 100, offset = 0 } = req.query;
            
            let filtered = this.writes;
            if (token) {
                filtered = filtered.filter(w => w.token === token);
            }

            res.json({
                writes: filtered.slice(offset, offset + parseInt(limit)),
                total: filtered.length
            });
        });

        // GET /checkpoints - Get all checkpoints (for testing)
        this.app.get('/checkpoints', (req, res) => {
            const { token } = req.query;
            
            let filtered = this.checkpoints;
            if (token) {
                filtered = filtered.filter(c => c.token === token);
            }

            res.json({
                checkpoints: filtered,
                total: filtered.length
            });
        });

        // DELETE /reset - Reset all data (for testing)
        this.app.delete('/reset', (req, res) => {
            this.writes = [];
            this.checkpoints = [];
            this.requests = [];
            this.requestCount = 0;
            res.json({ success: true });
        });
    }

    async start(port = 3030) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Test helpers
    getWrites() {
        return this.writes;
    }

    getCheckpoints() {
        return this.checkpoints;
    }

    getRequests() {
        return this.requests;
    }

    getRequestCount() {
        return this.requestCount;
    }

    setFailureMode(enabled) {
        this.failureMode = enabled;
    }

    setDelay(ms) {
        this.delay = ms;
    }

    setValidApiKey(key) {
        this.validApiKey = key;
    }

    reset() {
        this.writes = [];
        this.checkpoints = [];
        this.requests = [];
        this.requestCount = 0;
        this.failureMode = false;
        this.delay = 0;
        this.validApiKey = null;
    }
}

export default MockHoneygraph;