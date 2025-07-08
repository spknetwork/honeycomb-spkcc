import { store, Config } from "../index.mjs"
import { ipfsPeerConnect } from "../ipfsSaveState.js"

export const report = (json, from, active, pc) => {
    store.get(['markets', 'node', from], function(e, a) {
        if (!e) {
            var b = a
            if (from == b.self && active) {
                b.report = json
                delete b.report.timestamp
                var ops = [
                    { type: 'put', path: ['markets', 'node', from], data: b }
                ]
                if(json.ipfs_id && Config("ipfshost") == 'ipfs')ipfsPeerConnect(json.ipfs_id)
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            } else {
                pc[0](pc[2])
            }
        } else {
            pc[0](pc[2])
            console.log(e)
        }
    })
}

export const feed_publish = (tx, pc, runtimeContext) => {
    // tx contains: {
    //   publisher: string,
    //   exchange_rate: {
    //     base: string (e.g. "1.000 HBD"),
    //     quote: string (e.g. "3.500 HIVE")
    //   }
    // }
    
    const { store, getPathObj } = runtimeContext;
    const publisher = tx.publisher;
    
    // Get witness rolling buffer and price feeds
    let promises = [
        getPathObj(['witness']), // Rolling witness buffer (last 100 blocks)
        getPathObj(['priceFeeds']), // Current price feeds
        getPathObj(['stats']) // Stats object
    ];
    
    Promise.all(promises).then(mem => {
        const witnessBuffer = mem[0] || {};
        const priceFeeds = mem[1] || {};
        const stats = mem[2] || {};
        
        // Count how many blocks this publisher has witnessed in last 100 blocks
        let witnessCount = 0;
        for (let key in witnessBuffer) {
            if (witnessBuffer[key] === publisher) {
                witnessCount++;
            }
        }
        
        // Only accept price feed from witnesses who signed at least 4 blocks
        if (witnessCount >= 4) {
            // Parse the exchange rate
            const base = parseFloat(tx.exchange_rate.base.split(' ')[0]); // HBD amount
            const quote = parseFloat(tx.exchange_rate.quote.split(' ')[0]); // HIVE amount
            const hivePerHbd = quote / base;
            
            // Store price feed with block number for staleness checking
            priceFeeds[publisher] = {
                hivePerHbd: hivePerHbd,
                block: pc[2][2], // Current block number from pc context
                witnessCount: witnessCount
            };
            
            // Clean stale price feeds (from non-consensus witnesses)
            const consensusWitnesses = {};
            for (let key in witnessBuffer) {
                const witness = witnessBuffer[key];
                consensusWitnesses[witness] = (consensusWitnesses[witness] || 0) + 1;
            }
            
            // Remove price feeds from witnesses not in consensus (< 4 blocks)
            for (let witness in priceFeeds) {
                if ((consensusWitnesses[witness] || 0) < 4) {
                    delete priceFeeds[witness];
                }
            }
            
            // Calculate median price if we have enough feeds
            const activePrices = Object.values(priceFeeds).map(feed => feed.hivePerHbd);
            if (activePrices.length >= 3) {
                // Sort prices to find median
                activePrices.sort((a, b) => a - b);
                const medianIndex = Math.floor(activePrices.length / 2);
                
                let medianHivePerHbd;
                if (activePrices.length % 2 === 0) {
                    // Even number of prices - average the two middle values
                    medianHivePerHbd = (activePrices[medianIndex - 1] + activePrices[medianIndex]) / 2;
                } else {
                    // Odd number of prices - take the middle value
                    medianHivePerHbd = activePrices[medianIndex];
                }
                
                // Update stats with median prices
                stats.priceFeed = {
                    hivePerHbd: medianHivePerHbd,
                    hbdPrice: 1.0, // HBD is designed to be $1 USD
                    hivePrice: 1.0 / medianHivePerHbd, // HIVE price in HBD
                    lastUpdate: pc[2][2], // Block number
                    activePriceFeeds: activePrices.length
                };
            }
            
            // Store updated data
            const ops = [
                { type: 'put', path: ['priceFeeds'], data: priceFeeds },
                { type: 'put', path: ['stats'], data: stats }
            ];
            
            store.batch(ops, pc);
        } else {
            // Publisher hasn't signed enough blocks, ignore their price feed
            pc[0](pc[2]);
        }
    }).catch(e => {
        console.error('Error processing feed_publish:', e);
        pc[1](e);
    });
}
