import { chronAssign } from '../lil_ops.js';
import { getPathObj, getPathNum } from '../getPathObj.js';

// Double multisig system for enhanced security and advanced features
// Each multisig manages half the liquidity (HIVE/HBD split)
// Enables CD markets and time-locked escrows

export const multisig2_update = (json, from, active, pc, runtimeContext) => {
    const stats = runtimeContext.stats;
    const multiTracker = runtimeContext.multiTracker;
    
    if (!json.account || !json.ops) {
        pc.errors = 'account and ops required';
        return pc;
    }
    
    // Verify from is authorized runner
    if (!stats.runners[from]) {
        pc.errors = 'not authorized runner';
        return pc;
    }
    
    // Initialize multisig2 tracking
    if (!multiTracker.msAccounts) {
        multiTracker.msAccounts = {
            alpha: { // HIVE focused
                account: '',
                signers: {},
                threshold: 0,
                pending: {},
                holdings: { HIVE: 0, HBD: 0 }
            },
            beta: { // HBD focused
                account: '',
                signers: {},
                threshold: 0,
                pending: {},
                holdings: { HIVE: 0, HBD: 0 }
            }
        };
    }
    
    const target = json.target || 'alpha'; // alpha or beta multisig
    const ms = multiTracker.msAccounts[target];
    
    // Update account details
    ms.account = json.account;
    ms.threshold = json.ops.threshold;
    
    // Update signers with weights
    ms.signers = {};
    for (let auth of json.ops.account_auths) {
        ms.signers[auth[0]] = auth[1];
    }
    
    // Calculate effective collateral (sum of lowest threshold signers)
    const signerBalances = [];
    for (let signer in ms.signers) {
        const balance = getPathNum(['balances', signer], runtimeContext);
        signerBalances.push({ account: signer, balance, weight: ms.signers[signer] });
    }
    signerBalances.sort((a, b) => a.balance - b.balance);
    
    let effectiveCollateral = 0;
    let weightSum = 0;
    for (let signer of signerBalances) {
        effectiveCollateral += signer.balance;
        weightSum += signer.weight;
        if (weightSum >= ms.threshold) break;
    }
    
    ms.effectiveCollateral = effectiveCollateral;
    
    // Store update
    chronAssign(runtimeContext, `multiTracker:msAccounts:${target}`, ms, pc);
    
    pc.msg = `Updated ${target} multisig: ${json.account}`;
    return pc;
};

export const signing_queue_add = (json, from, active, pc, runtimeContext) => {
    const multiTracker = runtimeContext.multiTracker;
    
    if (!json.target || !json.txid || !json.signature) {
        pc.errors = 'target, txid, and signature required';
        return pc;
    }
    
    const ms = multiTracker.msAccounts[json.target];
    if (!ms || !ms.signers[from]) {
        pc.errors = 'not authorized signer';
        return pc;
    }
    
    // Initialize pending tx if needed
    if (!ms.pending[json.txid]) {
        ms.pending[json.txid] = {
            created: pc.num,
            expires: pc.num + 28800, // ~24 hours
            tx: json.tx,
            signatures: {},
            weight: 0
        };
    }
    
    const pending = ms.pending[json.txid];
    
    // Add signature if not already present
    if (!pending.signatures[from]) {
        pending.signatures[from] = json.signature;
        pending.weight += ms.signers[from];
        
        // Check if threshold met
        if (pending.weight >= ms.threshold) {
            pending.ready = true;
            // Broadcast would happen here in production
            // For now, mark for processing
            chronAssign(runtimeContext, `multiTracker:broadcast:${json.txid}`, {
                account: ms.account,
                tx: pending.tx,
                signatures: pending.signatures
            }, pc);
        }
    }
    
    chronAssign(runtimeContext, `multiTracker:msAccounts:${json.target}:pending:${json.txid}`, pending, pc);
    
    pc.msg = `Added signature from ${from} to ${json.txid}`;
    return pc;
};

export const create_cd = (json, from, active, pc, runtimeContext) => {
    const stats = runtimeContext.stats;
    const multiTracker = runtimeContext.multiTracker;
    
    // Validate inputs
    if (!json.type || !json.amount || !json.asset || !json.term) {
        pc.errors = 'type, amount, asset, and term required';
        return pc;
    }
    
    // CD types: user_hbd, user_hive, network_hbd, network_hive
    const validTypes = ['user_hbd', 'user_hive', 'network_hbd', 'network_hive'];
    if (!validTypes.includes(json.type)) {
        pc.errors = 'invalid CD type';
        return pc;
    }
    
    // Initialize CD tracking
    if (!multiTracker.cds) {
        multiTracker.cds = {};
    }
    
    const cdId = `${from}_${pc.num}_${json.type}`;
    const [direction, currency] = json.type.split('_');
    
    // Calculate terms based on type
    let cd = {
        id: cdId,
        type: json.type,
        creator: from,
        created: pc.num,
        maturity: pc.num + (json.term * 120), // term in hours * 120 blocks/hour
        status: 'pending',
        amount: json.amount
    };
    
    if (direction === 'user') {
        // User deposits SPK, gets HIVE/HBD escrow
        const spkBalance = getPathNum(['balances', from], runtimeContext);
        if (spkBalance < json.amount) {
            pc.errors = 'insufficient SPK balance';
            return pc;
        }
        
        // Calculate escrow amount (11.1% interest)
        const escrowAmount = currency === 'hbd' 
            ? Math.floor(json.amount * 0.111) // SPK to HBD rate
            : Math.floor(json.amount * 0.333); // SPK to HIVE rate
        
        cd.spkDeposit = json.amount;
        cd.escrowAmount = escrowAmount;
        cd.escrowAsset = currency.toUpperCase();
        
        // Deduct SPK
        chronAssign(runtimeContext, `balances:${from}`, spkBalance - json.amount, pc);
        
        // Track for escrow creation
        cd.escrowTarget = 'alpha'; // or beta based on asset
        
    } else {
        // Network deposits HIVE/HBD, user provides SPK collateral
        const collateralRequired = Math.floor(json.amount * 11); // 150% collateral in SPK
        const spkBalance = getPathNum(['balances', from], runtimeContext);
        
        if (spkBalance < collateralRequired) {
            pc.errors = 'insufficient SPK collateral';
            return pc;
        }
        
        cd.networkDeposit = json.amount;
        cd.depositAsset = currency.toUpperCase();
        cd.collateral = collateralRequired;
        cd.liquidationPrice = Math.floor(collateralRequired * 1.1); // 110% liquidation
        
        // Lock collateral
        chronAssign(runtimeContext, `balances:${from}`, spkBalance - collateralRequired, pc);
        chronAssign(runtimeContext, `collateral:${from}:${cdId}`, collateralRequired, pc);
    }
    
    // Store CD
    multiTracker.cds[cdId] = cd;
    chronAssign(runtimeContext, `multiTracker:cds:${cdId}`, cd, pc);
    
    pc.msg = `Created ${json.type} CD: ${cdId}`;
    return pc;
};

export const process_cd_maturity = (pc, runtimeContext) => {
    const multiTracker = runtimeContext.multiTracker;
    
    if (!multiTracker.cds) return;
    
    for (let cdId in multiTracker.cds) {
        const cd = multiTracker.cds[cdId];
        
        if (cd.status === 'active' && cd.maturity <= pc.num) {
            const [direction, currency] = cd.type.split('_');
            
            if (direction === 'user') {
                // User CD matured - they should receive their escrow
                cd.status = 'matured';
                cd.maturedAt = pc.num;
                
                // In production, trigger escrow release
                chronAssign(runtimeContext, `multiTracker:escrow_release:${cdId}`, {
                    to: cd.creator,
                    amount: cd.escrowAmount,
                    asset: cd.escrowAsset
                }, pc);
                
            } else {
                // Network CD matured - return collateral if paid
                const debt = getPathNum(['cdDebt', cdId], runtimeContext) || cd.networkDeposit;
                
                if (debt <= 0) {
                    // Paid off - return collateral
                    const currentBalance = getPathNum(['balances', cd.creator], runtimeContext);
                    chronAssign(runtimeContext, `balances:${cd.creator}`, 
                        currentBalance + cd.collateral, pc);
                    chronAssign(runtimeContext, `collateral:${cd.creator}:${cdId}`, 0, pc);
                    cd.status = 'completed';
                } else {
                    // Not paid - liquidate
                    cd.status = 'defaulted';
                    // Collateral goes to LP
                    const lpStats = getPathObj(['lpStats'], runtimeContext);
                    lpStats.spk = (lpStats.spk || 0) + cd.collateral;
                    chronAssign(runtimeContext, 'lpStats', lpStats, pc);
                }
            }
            
            chronAssign(runtimeContext, `multiTracker:cds:${cdId}`, cd, pc);
        }
    }
};

export const early_redeem_cd = (json, from, active, pc, runtimeContext) => {
    const multiTracker = runtimeContext.multiTracker;
    const stats = runtimeContext.stats;
    
    if (!json.cdId) {
        pc.errors = 'cdId required';
        return pc;
    }
    
    const cd = multiTracker.cds[json.cdId];
    if (!cd || cd.status !== 'active') {
        pc.errors = 'CD not found or not active';
        return pc;
    }
    
    const [direction, currency] = cd.type.split('_');
    
    if (direction === 'user' && stats.runners[from]) {
        // Network calling early redemption on user CD
        const timeRemaining = cd.maturity - pc.num;
        const percentComplete = 1 - (timeRemaining / (cd.maturity - cd.created));
        
        // Bonus curve: 10-25% bonus for early redemption
        const bonusRate = 0.1 + (0.15 * (1 - percentComplete));
        const bonusAmount = Math.floor(cd.spkDeposit * bonusRate);
        
        cd.earlyRedemption = {
            block: pc.num,
            bonusRate,
            bonusAmount,
            returned: cd.spkDeposit + bonusAmount
        };
        
        // Return SPK with bonus to user
        const userBalance = getPathNum(['balances', cd.creator], runtimeContext);
        chronAssign(runtimeContext, `balances:${cd.creator}`, 
            userBalance + cd.spkDeposit + bonusAmount, pc);
        
        cd.status = 'early_redeemed';
        chronAssign(runtimeContext, `multiTracker:cds:${cdId}`, cd, pc);
        
        pc.msg = `Early redeemed ${cdId} with ${bonusRate * 100}% bonus`;
        
    } else if (direction === 'network' && from === cd.creator) {
        // User wants early exit from network CD
        const timeRemaining = cd.maturity - pc.num;
        const percentComplete = 1 - (timeRemaining / (cd.maturity - cd.created));
        
        // Penalty curve: 10-20% penalty for early exit
        const penaltyRate = 0.2 * (1 - percentComplete);
        const penaltyAmount = Math.floor(cd.collateral * penaltyRate);
        
        // Return collateral minus penalty
        const returnAmount = cd.collateral - penaltyAmount;
        const userBalance = getPathNum(['balances', from], runtimeContext);
        chronAssign(runtimeContext, `balances:${from}`, userBalance + returnAmount, pc);
        
        // Penalty goes to LP
        const lpStats = getPathObj(['lpStats'], runtimeContext);
        lpStats.spk = (lpStats.spk || 0) + penaltyAmount;
        chronAssign(runtimeContext, 'lpStats', lpStats, pc);
        
        cd.status = 'early_exit';
        cd.earlyExit = {
            block: pc.num,
            penaltyRate,
            penaltyAmount,
            returned: returnAmount
        };
        
        chronAssign(runtimeContext, `multiTracker:cds:${cdId}`, cd, pc);
        chronAssign(runtimeContext, `collateral:${from}:${cdId}`, 0, pc);
        
        pc.msg = `Early exit ${cdId} with ${penaltyRate * 100}% penalty`;
    } else {
        pc.errors = 'not authorized for early redemption';
    }
    
    return pc;
};

// Cleanup expired pending transactions
export const cleanup_expired_multisig = (pc, runtimeContext) => {
    const multiTracker = runtimeContext.multiTracker;
    
    if (!multiTracker.msAccounts) return;
    
    for (let msType in multiTracker.msAccounts) {
        const ms = multiTracker.msAccounts[msType];
        
        for (let txid in ms.pending) {
            if (ms.pending[txid].expires < pc.num) {
                delete ms.pending[txid];
                chronAssign(runtimeContext, `multiTracker:msAccounts:${msType}:pending:${txid}`, 
                    null, pc);
            }
        }
    }
};

// Balance liquidity between alpha and beta multisigs
export const balance_dual_multisig = (pc, runtimeContext) => {
    const multiTracker = runtimeContext.multiTracker;
    const stats = runtimeContext.stats;
    
    if (!multiTracker.msAccounts || !stats.medianHivePrice) return;
    
    const alpha = multiTracker.msAccounts.alpha;
    const beta = multiTracker.msAccounts.beta;
    
    if (!alpha.account || !beta.account) return;
    
    // Calculate USD values
    const alphaUSD = (alpha.holdings.HIVE * stats.medianHivePrice) + alpha.holdings.HBD;
    const betaUSD = (beta.holdings.HIVE * stats.medianHivePrice) + beta.holdings.HBD;
    
    // Target 50/50 split
    const totalUSD = alphaUSD + betaUSD;
    const targetUSD = totalUSD / 2;
    
    if (Math.abs(alphaUSD - targetUSD) > totalUSD * 0.05) { // 5% threshold
        // Rebalance needed
        chronAssign(runtimeContext, 'multiTracker:rebalance_needed', {
            alpha: alphaUSD,
            beta: betaUSD,
            target: targetUSD,
            block: pc.num
        }, pc);
    }
};