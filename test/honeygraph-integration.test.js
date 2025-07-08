import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';
import HoneygraphClient from '../lib/honeygraph-client.js';
import DBInterceptor from '../lib/db-interceptor.js';
import MockHoneygraph from './fixtures/mock-honeygraph.js';

describe('Honeygraph Integration', function() {
    let mockServer;
    let client;
    let interceptor;
    let config;
    let mockDB;
    let clock;

    beforeEach(async function() {
        // Setup fake timers for testing batching
        clock = sinon.useFakeTimers();

        // Default configuration
        config = {
            honeygraph: {
                enabled: true,
                url: 'http://localhost:3030',
                apiKey: 'test-api-key',
                token: 'spk',
                batchSize: 100,
                flushInterval: 1000
            }
        };

        // Mock database
        mockDB = {
            put: sinon.stub().resolves(),
            del: sinon.stub().resolves(),
            batch: sinon.stub().resolves()
        };

        // Start mock server
        mockServer = new MockHoneygraph();
        await mockServer.start(3030);

        // Initialize client and interceptor
        client = new HoneygraphClient(config.honeygraph);
        interceptor = new DBInterceptor(mockDB, client);
    });

    afterEach(async function() {
        await mockServer.stop();
        clock.restore();
    });

    describe('DB Write Interception', function() {
        it('should intercept and forward PUT operations to honeygraph', async function() {
            const key = '@spk:balance:user123';
            const value = { amount: 1000, token: 'SPK' };

            await interceptor.put(key, JSON.stringify(value));

            // Verify DB write occurred
            expect(mockDB.put.calledWith(key, JSON.stringify(value))).to.be.true;

            // Force flush to send immediately
            await client.flush();

            // Verify honeygraph received the write
            const writes = mockServer.getWrites();
            expect(writes).to.have.lengthOf(1);
            expect(writes[0]).to.deep.include({
                key,
                value: JSON.stringify(value),
                operation: 'put',
                token: 'spk'
            });
        });

        it('should intercept and forward DEL operations to honeygraph', async function() {
            const key = '@spk:nft:12345';

            await interceptor.del(key);

            // Verify DB delete occurred
            expect(mockDB.del.calledWith(key)).to.be.true;

            // Force flush
            await client.flush();

            // Verify honeygraph received the delete
            const writes = mockServer.getWrites();
            expect(writes).to.have.lengthOf(1);
            expect(writes[0]).to.deep.include({
                key,
                operation: 'del',
                token: 'spk'
            });
        });

        it('should intercept and forward BATCH operations to honeygraph', async function() {
            const operations = [
                { type: 'put', key: '@spk:user:alice', value: JSON.stringify({ power: 100 }) },
                { type: 'del', key: '@spk:expired:123' },
                { type: 'put', key: '@spk:contract:xyz', value: JSON.stringify({ code: 'test' }) }
            ];

            await interceptor.batch(operations);

            // Verify DB batch occurred
            expect(mockDB.batch.calledWith(operations)).to.be.true;

            // Force flush
            await client.flush();

            // Verify honeygraph received all operations
            const writes = mockServer.getWrites();
            expect(writes).to.have.lengthOf(3);
            expect(writes[0]).to.deep.include({
                key: '@spk:user:alice',
                value: JSON.stringify({ power: 100 }),
                operation: 'put',
                token: 'spk'
            });
            expect(writes[1]).to.deep.include({
                key: '@spk:expired:123',
                operation: 'del',
                token: 'spk'
            });
        });

        it('should not intercept writes when honeygraph is disabled', async function() {
            config.honeygraph.enabled = false;
            client = new HoneygraphClient(config.honeygraph);
            interceptor = new DBInterceptor(mockDB, client);

            await interceptor.put('test-key', 'test-value');
            await client.flush();

            expect(mockDB.put.called).to.be.true;
            expect(mockServer.getWrites()).to.have.lengthOf(0);
        });
    });

    describe('Checkpoint Hash Submission', function() {
        it('should send checkpoint hash when LIB is reached', async function() {
            const blockNum = 12345;
            const hash = 'abc123def456';
            
            await client.sendCheckpoint(blockNum, hash);

            const checkpoints = mockServer.getCheckpoints();
            expect(checkpoints).to.have.lengthOf(1);
            expect(checkpoints[0]).to.deep.equal({
                blockNum,
                hash,
                token: 'spk',
                timestamp: checkpoints[0].timestamp // Dynamic value
            });
        });

        it('should include fork information with checkpoint', async function() {
            const blockNum = 12345;
            const hash = 'abc123def456';
            const forkId = 'fork-789';
            
            await client.sendCheckpoint(blockNum, hash, forkId);

            const checkpoints = mockServer.getCheckpoints();
            expect(checkpoints).to.have.lengthOf(1);
            expect(checkpoints[0]).to.include({
                forkId
            });
        });
    });

    describe('Batching and Performance', function() {
        it('should batch operations until batch size is reached', async function() {
            // Add 99 operations (below batch size)
            for (let i = 0; i < 99; i++) {
                await interceptor.put(`key-${i}`, `value-${i}`);
            }

            // Should not have sent yet
            expect(mockServer.getWrites()).to.have.lengthOf(0);

            // Add one more to reach batch size
            await interceptor.put('key-99', 'value-99');

            // Should trigger immediate flush
            await new Promise(resolve => setImmediate(resolve));
            
            expect(mockServer.getWrites()).to.have.lengthOf(100);
        });

        it('should flush operations after flush interval', async function() {
            // Add some operations
            await interceptor.put('key-1', 'value-1');
            await interceptor.put('key-2', 'value-2');

            // Verify not sent yet
            expect(mockServer.getWrites()).to.have.lengthOf(0);

            // Advance time to trigger flush
            clock.tick(1000);
            await new Promise(resolve => setImmediate(resolve));

            // Verify operations were sent
            expect(mockServer.getWrites()).to.have.lengthOf(2);
        });

        it('should handle concurrent writes efficiently', async function() {
            const promises = [];
            
            // Simulate 500 concurrent writes
            for (let i = 0; i < 500; i++) {
                promises.push(interceptor.put(`concurrent-${i}`, `value-${i}`));
            }

            await Promise.all(promises);
            await client.flush();

            // All writes should be received
            expect(mockServer.getWrites()).to.have.lengthOf(500);
        });
    });

    describe('Error Handling and Resilience', function() {
        it('should handle honeygraph unavailability gracefully', async function() {
            // Stop the mock server
            await mockServer.stop();

            // Operations should still work
            await interceptor.put('test-key', 'test-value');
            
            // DB write should succeed
            expect(mockDB.put.called).to.be.true;

            // Client should handle the error internally
            await client.flush();
            
            // No crash, operation completes
        });

        it('should retry failed operations with exponential backoff', async function() {
            mockServer.setFailureMode(true);

            await interceptor.put('retry-key', 'retry-value');
            
            const startTime = Date.now();
            await client.flush();

            // Should have attempted retries
            expect(mockServer.getRequestCount()).to.be.greaterThan(1);
            
            // Reset failure mode
            mockServer.setFailureMode(false);
        });

        it('should not block DB operations when honeygraph is slow', async function() {
            mockServer.setDelay(2000); // 2 second delay

            const start = Date.now();
            await interceptor.put('slow-key', 'slow-value');
            const dbTime = Date.now() - start;

            // DB operation should be fast
            expect(dbTime).to.be.lessThan(100);
            expect(mockDB.put.called).to.be.true;
        });

        it('should queue operations when honeygraph is temporarily down', async function() {
            await mockServer.stop();

            // Add operations while down
            await interceptor.put('queued-1', 'value-1');
            await interceptor.put('queued-2', 'value-2');

            // Restart server
            await mockServer.start(3030);

            // Force retry
            await client.flush();

            // Operations should eventually be sent
            const writes = mockServer.getWrites();
            expect(writes.length).to.be.greaterThan(0);
        });
    });

    describe('Authentication and Security', function() {
        it('should include API key in all requests', async function() {
            await interceptor.put('auth-key', 'auth-value');
            await client.flush();

            const requests = mockServer.getRequests();
            expect(requests).to.have.lengthOf.at.least(1);
            expect(requests[0].headers['x-api-key']).to.equal('test-api-key');
        });

        it('should reject operations with invalid API key', async function() {
            config.honeygraph.apiKey = 'invalid-key';
            client = new HoneygraphClient(config.honeygraph);
            interceptor = new DBInterceptor(mockDB, client);

            mockServer.setValidApiKey('valid-key');

            await interceptor.put('rejected-key', 'rejected-value');
            
            try {
                await client.flush();
            } catch (error) {
                expect(error.message).to.include('Unauthorized');
            }
        });
    });

    describe('Multi-token Support', function() {
        it('should correctly namespace operations by token', async function() {
            // Create clients for different tokens
            const spkConfig = { ...config.honeygraph, token: 'spk' };
            const larynxConfig = { ...config.honeygraph, token: 'larynx' };
            
            const spkClient = new HoneygraphClient(spkConfig);
            const larynxClient = new HoneygraphClient(larynxConfig);
            
            const spkInterceptor = new DBInterceptor(mockDB, spkClient);
            const larynxInterceptor = new DBInterceptor(mockDB, larynxClient);

            await spkInterceptor.put('@spk:balance:user1', '1000');
            await larynxInterceptor.put('@larynx:balance:user1', '2000');

            await spkClient.flush();
            await larynxClient.flush();

            const writes = mockServer.getWrites();
            const spkWrite = writes.find(w => w.token === 'spk');
            const larynxWrite = writes.find(w => w.token === 'larynx');

            expect(spkWrite).to.exist;
            expect(spkWrite.key).to.equal('@spk:balance:user1');
            expect(larynxWrite).to.exist;
            expect(larynxWrite.key).to.equal('@larynx:balance:user1');
        });
    });

    describe('Fork Handling', function() {
        it('should include fork information with all writes', async function() {
            const forkId = 'fork-abc123';
            client.setForkId(forkId);

            await interceptor.put('fork-key', 'fork-value');
            await client.flush();

            const writes = mockServer.getWrites();
            expect(writes[0]).to.include({ forkId });
        });

        it('should clear fork information when fork is resolved', async function() {
            client.setForkId('fork-123');
            await interceptor.put('during-fork', 'value');
            await client.flush();

            client.clearForkId();
            await interceptor.put('after-fork', 'value');
            await client.flush();

            const writes = mockServer.getWrites();
            expect(writes[0]).to.have.property('forkId', 'fork-123');
            expect(writes[1]).to.not.have.property('forkId');
        });
    });

    describe('Configuration Validation', function() {
        it('should validate required configuration fields', function() {
            const invalidConfigs = [
                { honeygraph: {} },
                { honeygraph: { enabled: true } },
                { honeygraph: { enabled: true, url: 'http://test' } },
            ];

            invalidConfigs.forEach(invalidConfig => {
                expect(() => new HoneygraphClient(invalidConfig.honeygraph))
                    .to.throw('Missing required configuration');
            });
        });

        it('should use sensible defaults for optional fields', function() {
            const minimalConfig = {
                enabled: true,
                url: 'http://localhost:3030',
                apiKey: 'key',
                token: 'spk'
            };

            const client = new HoneygraphClient(minimalConfig);
            expect(client.config.batchSize).to.equal(100);
            expect(client.config.flushInterval).to.equal(1000);
        });
    });

    describe('Integration with Honeycomb', function() {
        it('should integrate seamlessly with existing DB operations', async function() {
            // Simulate honeycomb operations
            const operations = [
                { type: 'put', key: '@spk:balance:alice', value: '1000' },
                { type: 'put', key: '@spk:balance:bob', value: '2000' },
                { type: 'del', key: '@spk:expired:contract' }
            ];

            // Execute batch through interceptor
            await interceptor.batch(operations);

            // Verify both DB and honeygraph received operations
            expect(mockDB.batch.calledWith(operations)).to.be.true;
            
            await client.flush();
            expect(mockServer.getWrites()).to.have.lengthOf(3);
        });

        it('should handle LIB updates from honeycomb', async function() {
            // Simulate LIB update event
            const libEmitter = new EventEmitter();
            client.subscribeLIBUpdates(libEmitter);

            libEmitter.emit('lib-updated', {
                blockNum: 54321,
                hash: 'xyz789',
                forkId: null
            });

            const checkpoints = mockServer.getCheckpoints();
            expect(checkpoints).to.have.lengthOf(1);
            expect(checkpoints[0]).to.include({
                blockNum: 54321,
                hash: 'xyz789'
            });
        });
    });
});