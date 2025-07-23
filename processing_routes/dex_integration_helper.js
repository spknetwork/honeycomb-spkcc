/**
 * Integration helper to use flexible multi-token DEX with existing code
 * This shows how to integrate without completely replacing existing functionality
 */

import { handleDEXTrade as handleFlexibleDEXTrade } from './dex_handlers_flexible.js';

/**
 * Wrapper function that adds multi-token support to existing transfer handler
 * @param {object} originalHandler - The original transfer handler function
 * @param {object} tokenConfig - Token configuration
 * @returns {function} Enhanced transfer handler with multi-token support
 */
export const enhanceTransferWithMultiToken = (originalHandler, tokenConfig) => {
  return function enhancedTransfer(json, pc, context) {
    // Add token configuration to context
    const enhancedContext = {
      ...context,
      config: {
        ...context.config,
        ...tokenConfig
      }
    };
    
    // Check if this is a DEX trade based on memo
    if (json.to === context.config.msaccount && 
        json.from !== context.config.msaccount) {
      
      // Try to parse memo as JSON for token info
      try {
        const order = JSON.parse(json.memo);
        
        // If memo contains token info, use flexible handler
        if (order.token || tokenConfig.tokenDexMap) {
          return handleFlexibleDEXTrade(json, pc, enhancedContext);
        }
      } catch (e) {
        // Not JSON memo, check if it's a simple DEX trade
        const memoWords = json.memo.split(" ");
        
        // If no special prefix (NFT, etc.), treat as DEX trade
        if (memoWords.length === 1 || !['NFT', 'NFTtrade', 'NFTbid', 'NFTbuy'].includes(memoWords[0])) {
          return handleFlexibleDEXTrade(json, pc, enhancedContext);
        }
      }
    }
    
    // Otherwise, use original handler
    return originalHandler.call(this, json, pc, context);
  };
};

/**
 * Helper to process multi-token DEX operations within existing code
 * Can be called from within your existing transfer function
 */
export const processMultiTokenDEX = async (json, remaining, dex, order, context) => {
  // Determine token configuration
  const token = order.token || context.config.TOKEN || 'LARYNX';
  const tokenConfig = context.config.tokenDexMap?.[token] || {
    dexPath: 'dex',
    balancePath: 'balances',
    totalPath: ['balances', 't'],
    symbol: token
  };
  
  // Process based on token type
  if (token !== context.config.TOKEN) {
    // Different token - use appropriate paths
    const tokenDex = await context.getPathObj([tokenConfig.dexPath, order.pair]);
    const tokenBal = await context.getPathNum([tokenConfig.balancePath, json.from]);
    
    return {
      dex: tokenDex,
      bal: tokenBal,
      tokenConfig
    };
  }
  
  // Default token - use existing data
  return {
    dex,
    bal: await context.getPathNum(['balances', json.from]),
    tokenConfig
  };
};

/**
 * Minimal configuration for common tokens
 * Can be imported and extended as needed
 */
export const minimalTokenConfig = {
  tokenDexMap: {
    'LARYNX': {
      dexPath: 'dex',
      balancePath: 'balances',
      symbol: 'LARYNX'
    },
    'SPK': {
      dexPath: 'dexs', 
      balancePath: 'spk',
      symbol: 'SPK'
    },
    'BROCA': {
      dexPath: 'dexb',
      balancePath: 'lbroca', 
      symbol: 'BROCA'
    }
  },
  
  // Simple token fee routing
  tokenFeeHandlers: {
    'SPK': async (fee, context) => {
      // Add to SPK unissued pool
      const current = await context.getPathNum(['spk', 'u']) || 0;
      await context.store.put(['spk', 'u'], current + fee);
    },
    'BROCA': async (fee, context) => {
      // Add to BROCA unissued pool
      const current = await context.getPathNum(['lbroca', 'u']) || 0;
      await context.store.put(['lbroca', 'u'], current + fee);
    }
  }
};

/**
 * Example of gradual integration in existing dex.js
 */
export const integrationExample = `
// In your existing dex.js transfer function:

import { processMultiTokenDEX, minimalTokenConfig } from './dex_integration_helper.js';

export const transfer = (json, pc) => {
  // ... existing code ...
  
  if (order.type == "MARKET" || order.type == "LIMIT") {
    // Check if this is a multi-token trade
    if (order.token && order.token !== Config("TOKEN")) {
      // Use multi-token processor
      const context = {
        config: { ...Config, ...minimalTokenConfig },
        getPathObj,
        getPathNum,
        store,
        // ... other utilities
      };
      
      const { dex, bal, tokenConfig } = await processMultiTokenDEX(
        json, remaining, dex, order, context
      );
      
      // Continue with modified dex and bal values
      // ... rest of processing
    }
    
    // ... existing processing for default token
  }
}`;