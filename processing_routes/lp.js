import { getPathObj, getPathNum } from "../getPathObj.js"
import { store, Config } from "../index.mjs"

// Operation handler for adopting ICO LP
export const adopt_lp = (json, from, active, pc, runtimeContext) => {
  // json = { amount: 1000000 } // Amount in millitokens
  
  if (!active) {
    pc[0](pc[2]); // Requires active key
    return;
  }
  
  const amount = parseInt(json.amount || 0);
  if (amount <= 0) {
    pc[0](pc[2]);
    return;
  }
  
  Promise.all([
    getPathObj(['stats']),
    getPathObj(['ico']),
    getPathObj(['runners']),
    getPathNum([Config("govToken"), from])
  ]).then(([stats, ico, runners, govBalance]) => {
    // Must be a runner
    if (!runners[from]) {
      pc[0](pc[2]);
      return;
    }
    
    // Check collateral requirements
    const collateralRequired = parseInt(amount * (stats.multiSigCollateral || 1000000) / (stats.safetyLimit || 1000000));
    if (govBalance < collateralRequired) {
      pc[0](pc[2]);
      return;
    }
    
    // Check available uncollateralized LP
    const available = Math.min(amount, (ico?.uncollateralized || 0));
    if (available <= 0) {
      pc[0](pc[2]);
      return;
    }
    
    let ops = [];
    
    // Initialize structures if needed
    if (!ico) ico = { uncollateralized: 0, participants: {} };
    if (!stats.lpStats) stats.lpStats = {};
    if (!stats.lpStats.ico) stats.lpStats.ico = { hive: 0, hbd: 0, uncollateralized: 0 };
    if (!stats.lpStats[from]) stats.lpStats[from] = { 
      hive: 0, 
      hbd: 0, 
      adopted: 0,
      feeMultiplier: 1 
    };
    
    // Move from uncollateralized to adopted
    ico.uncollateralized -= available;
    stats.lpStats.ico.uncollateralized -= available;
    stats.lpStats.ico.hive -= available;
    
    // Credit runner with adopted LP
    stats.lpStats[from].adopted = (stats.lpStats[from].adopted || 0) + available;
    stats.lpStats[from].hive += available;
    stats.lpStats[from].feeMultiplier = 2; // 2x fees for providing collateral
    
    // Update state
    ops.push({ type: 'put', path: ['ico'], data: ico });
    ops.push({ type: 'put', path: ['stats'], data: stats });
    ops.push({
      type: 'put',
      path: ['feed', `${pc[2][0]}:${pc[2][1]}`],
      data: `@${from} adopted ${(available / 1000).toFixed(3)} HIVE of uncollateralized ICO LP`
    });
    
    store.batch(ops, pc);
  }).catch(e => {
    console.error('Error in adopt_lp:', e);
    pc[1](e);
  });
};