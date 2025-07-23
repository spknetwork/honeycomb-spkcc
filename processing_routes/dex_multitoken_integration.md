# Multi-Token DEX Integration Guide

## Overview
This guide explains how the refactored DEX system supports multiple tokens without hardcoding specific token names into the base code. The system is designed to be flexible and configurable.

## Key Features

### 1. **Dynamic Token Configuration**
- Tokens are not hardcoded in the handler functions
- Configuration determines storage paths and behavior
- Easy to add new tokens without modifying base code

### 2. **Flexible Path Resolution**
```javascript
// Instead of hardcoded paths like:
// 'dexs' for SPK, 'dexb' for BROCA, 'dex' for LARYNX

// The system uses:
const tokenConfig = getTokenDexConfig(order.token, config);
// Returns: { dexPath, balancePath, totalPath, symbol, precision }
```

### 3. **Configurable Token Behavior**
Each token can have:
- Custom storage paths
- Specific calculations (e.g., collateral value)
- Trading restrictions
- Fee handling logic
- Clawback mechanisms

## Implementation Files

### 1. `dex_handlers_flexible.js`
The main handler that processes DEX trades for any token:
- No hardcoded token names
- Uses configuration to determine behavior
- Supports all DEX operations (market/limit orders, LP swaps)

### 2. `dex_config_example.js`
Example configuration showing how to set up multiple tokens:
- Token path mappings
- Custom calculations per token
- Fee distribution rules
- Trading restrictions

### 3. `dex_utils.js`
Shared utility functions that work with any token

## Usage Example

### 1. Configure Your Tokens
```javascript
const dexConfiguration = {
  TOKEN: 'LARYNX',  // Default token
  
  tokenDexMap: {
    'LARYNX': {
      dexPath: 'dex',
      balancePath: 'balances',
      totalPath: ['balances', 't']
    },
    'SPK': {
      dexPath: 'dexs',
      balancePath: 'spk',
      totalPath: ['spk', 't']
    },
    'YOUR_TOKEN': {
      dexPath: 'dexy',
      balancePath: 'yourtoken',
      totalPath: ['yourtoken', 't']
    }
  }
};
```

### 2. Set Up Custom Behavior
```javascript
tokenSpecificCalcs: {
  'YOUR_TOKEN': (stats, tick) => {
    // Custom calculations for your token
    stats.yourTokenValue = parseInt(stats.yourTokenSupply * tick);
  }
}
```

### 3. Use in Transfer Handler
```javascript
const CustomOperationsProcessing = [{
  type: "onOperation",
  op: "transfer",
  func: function (json, pc, context) {
    // Add configuration to context
    context.config = { ...context.config, ...dexConfiguration };
    
    // Let the flexible handler process it
    if (json.to === context.config.msaccount) {
      return handleDEXTrade(json, pc, context);
    }
  }
}];
```

## Memo Format for Trading

Users specify the token in their transfer memo:

```javascript
// Market buy default token (LARYNX)
memo: '{}'

// Market buy SPK
memo: '{"token":"SPK"}'

// Limit buy BROCA at 0.15
memo: '{"rate":"0.15","token":"BROCA"}'

// Limit buy new token
memo: '{"rate":"0.25","token":"YOUR_TOKEN"}'
```

## Adding a New Token

1. **Add to tokenDexMap**:
```javascript
'NEW_TOKEN': {
  dexPath: 'dexn',      // Where DEX data is stored
  balancePath: 'newt',   // Where balances are stored
  totalPath: ['newt', 't']  // Total supply path
}
```

2. **Add Custom Behavior** (optional):
```javascript
tokenSpecificCalcs: {
  'NEW_TOKEN': (stats, tick) => {
    // Your custom logic
  }
}
```

3. **Add Fee Handler** (optional):
```javascript
tokenFeeHandlers: {
  'NEW_TOKEN': async (fee, context) => {
    // How to distribute fees
  }
}
```

## Benefits

1. **No Code Changes Required**: Add new tokens through configuration only
2. **Consistent Interface**: All tokens use the same DEX operations
3. **Flexible Storage**: Each token can have its own storage structure
4. **Custom Logic**: Token-specific behavior without modifying base code
5. **Easy Maintenance**: Changes to token behavior don't affect others

## Migration from Hardcoded System

If you have existing hardcoded tokens (like SPK, BROCA), you can:

1. Create a configuration mapping for existing tokens
2. Replace hardcoded handlers with the flexible handler
3. Gradually migrate token-specific logic to configuration
4. Remove hardcoded references once migration is complete

## Testing

Test with different token configurations:
```javascript
// Test configuration
const testConfig = {
  tokenDexMap: {
    'TEST1': { dexPath: 'dext1', balancePath: 'test1' },
    'TEST2': { dexPath: 'dext2', balancePath: 'test2' }
  }
};

// Run tests with different tokens
testDEXTrade('TEST1', '0.1');
testDEXTrade('TEST2', '0.2');
```

## Best Practices

1. **Keep Configuration Centralized**: Store all token configs in one place
2. **Document Token Behavior**: Clearly document any custom logic
3. **Use Consistent Naming**: Follow patterns for paths (e.g., `dex{suffix}`)
4. **Test Thoroughly**: Test each token's specific behavior
5. **Version Your Config**: Track configuration changes over time