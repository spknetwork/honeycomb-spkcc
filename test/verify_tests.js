// Simple verification script to test our operations without the full test framework
import { send, claim } from './../processing_routes/send.js';
import { power_up, power_down, power_grant } from './../processing_routes/power.js';
import { vote } from './../processing_routes/vote.js';
import { store } from './../index.mjs';

// Set test environment
process.env.npm_lifecycle_event = 'test';

// Mock Config
global.Config = (key) => {
    const config = {
        'TOKEN': 'LARYNX',
        'msaccount': 'honeycomb-msig',
        'jsonTokenName': 'larynx',
        'hookurl': false,
        'status': false,
        'dao': 200,
        'dex': 200,
        'node': 600,
        'features': { dex: true, nft: true }
    };
    return config[key];
};

// Mock functions
global.postToDiscord = () => {};
global.chronAssign = (block, data) => Promise.resolve(`${block}:chrono:${data.op}`);

// Test helper
function callOp(opFunc, json, from, active = true) {
    return new Promise((resolve) => {
        const pc = [() => {}, () => {}, []];
        opFunc(json, from, active, pc);
        setTimeout(() => resolve(pc[2]), 100);
    });
}

// Simple test state
const testState = {
    balances: {
        'alice': 50000000,
        'bob': 30000000
    },
    cbalances: {
        'alice': 10000000
    },
    pow: {
        'alice': 5000000,
        'bob': 2000000,
        't': 20000000
    },
    gov: {
        't': 0
    },
    stats: {
        dao: 200,
        dex: 200,
        node: 600,
        last_processed: 1
    }
};

async function runTests() {
    console.log('Starting test verification...\n');
    
    // Initialize store
    await new Promise((resolve, reject) => {
        store.del([], (e) => {
            if (e) console.log('Error clearing store:', e);
            store.put([], testState, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
    
    console.log('✓ Store initialized\n');
    
    // Test 1: Token Send
    console.log('Test 1: Token Send Operation');
    try {
        const sendOps = await callOp(send, {
            to: 'bob',
            amount: 5000000,
            block_num: 1000,
            transaction_id: 'test_send'
        }, 'alice');
        
        if (sendOps && sendOps.length > 0) {
            console.log('✓ Send operation generated', sendOps.length, 'operations');
            const balanceOp = sendOps.find(op => op.path[0] === 'balances' && op.path[1] === 'alice');
            if (balanceOp) {
                console.log('✓ Alice balance reduced to:', balanceOp.data);
            }
        } else {
            console.log('✗ Send operation failed');
        }
    } catch (e) {
        console.log('✗ Send test error:', e.message);
    }
    
    console.log('\nTest 2: Power Up Operation');
    try {
        const powerOps = await callOp(power_up, {
            larynx: 2000000,
            block_num: 1001,
            transaction_id: 'test_power'
        }, 'bob');
        
        if (powerOps && powerOps.length > 0) {
            console.log('✓ Power up operation generated', powerOps.length, 'operations');
            const powOp = powerOps.find(op => op.path[0] === 'pow' && op.path[1] === 'bob');
            if (powOp) {
                console.log('✓ Bob power increased to:', powOp.data);
            }
        } else {
            console.log('✗ Power up operation failed');
        }
    } catch (e) {
        console.log('✗ Power up test error:', e.message);
    }
    
    console.log('\nTest 3: Claim Operation');
    try {
        const claimOps = await callOp(claim, {
            gov: false,
            block_num: 1002,
            transaction_id: 'test_claim'
        }, 'alice');
        
        if (claimOps && claimOps.length > 0) {
            console.log('✓ Claim operation generated', claimOps.length, 'operations');
            const delOp = claimOps.find(op => op.type === 'del' && op.path[0] === 'cbalances');
            if (delOp) {
                console.log('✓ Claimable balance cleared');
            }
        } else {
            console.log('✗ Claim operation failed');
        }
    } catch (e) {
        console.log('✗ Claim test error:', e.message);
    }
    
    console.log('\nTest 4: Vote Operation');
    try {
        const voteOps = await callOp(vote, {
            author: 'content-creator',
            permlink: 'test-post',
            weight: 10000,
            block_num: 1003,
            transaction_id: 'test_vote'
        }, 'alice');
        
        if (voteOps && voteOps.length > 0) {
            console.log('✓ Vote operation generated', voteOps.length, 'operations');
        } else {
            console.log('✗ Vote operation failed');
        }
    } catch (e) {
        console.log('✗ Vote test error:', e.message);
    }
    
    console.log('\n✅ Test verification complete!');
    process.exit(0);
}

// Run tests
runTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});