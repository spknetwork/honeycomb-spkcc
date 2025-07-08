import { config } from './config.js';
import { API, RAM } from './routes/api.js'
import { HR } from './processing_routes/index.mjs'
import { NFT, Chron, Watchdog, Log, Base64, Base58, Base38, DEX, verifySig } from './helpers.js'
import { burn, forceCancel, add, addc, addMT, addCol, addGov, deletePointer, credit, nodeUpdate, penalty, chronAssign, hashThis, isEmpty, naizer, release } from './lil_ops.js'
import { getPathObj, getPathNum, getPathSome } from './getPathObj.js'
import { postToDiscord } from './discord.js'
import fetch from 'node-fetch';
import WebSocket from 'ws';
import stringify from 'json-stable-stringify';

export var runtimeContext;
export var CodeShare = config.CodeShare || {};
// Make CodeShare available globally for rehydrated functions
globalThis.CodeShare = CodeShare;

// Initialize Every as empty array first, then populate it lazily
export var Every = [];

// Function to initialize Every when HR is available
function initializeEvery() {
  if (Every.length === 0) {
    console.log('Initializing Every array with HR functions...');
    console.log('HR.margins:', typeof HR.margins, HR.margins ? 'exists' : 'missing');
    console.log('HR.witness_mod:', typeof HR.witness_mod, HR.witness_mod ? 'exists' : 'missing');
    Every.push(HR.margins, HR.witness_mod, ...(config.CustomEvery || []));
    console.log('Every array initialized with', Every.length, 'functions');
  }
  return Every;
}

export function initializeContext(processorToUse, storeToUse, statusToUse, versionToUse) {
  // Make a copy of config for runtimeContext.config, excluding sensitive keys.
  const configCopy = { ...config }; // global config is updated by hotConfig
  delete configCopy.active;
  delete configCopy.msowner;

  // Initialize Every now that HR is available
  initializeEvery();

  runtimeContext = { 
    store: storeToUse,
    config: configCopy, 
    fetch, WebSocket, API, 
    VERSION: versionToUse, 
    getPathObj, getPathNum, getPathSome, RAM, 
    burn, forceCancel, add, addc, addMT, addCol, addGov, deletePointer, credit, nodeUpdate, penalty, chronAssign, hashThis, isEmpty, postToDiscord, 
    Base64, Base58, Base38, stringify, NFT, Chron, stringify, DEX, naizer, release, 
    status: statusToUse, 
    verifySig, 
    CodeShare, // Uses the current module-level CodeShare
    Every,     // Uses the current module-level Every
    processor: processorToUse 
  };

  console.log('runtimeContext initialized/updated');
}

export function hotAPI(api) {
  if (config.CustomAPI == "NA") return

  // First, remove any existing routes that match our custom routes
  api._router.stack = api._router.stack.filter(layer => {
    if (!layer.route) return true; // Keep non-route middleware
    
    // Check if this route should be overridden by a custom route
    const shouldOverride = config.CustomAPI.some(customRoute => {
      // Convert route paths to regex patterns for matching
      const staticPattern = layer.route.path
        .replace(/:[^/]+/g, '([^/]+)') // Convert :param to regex
        .replace(/\//g, '\\/'); // Escape forward slashes
      const staticRegex = new RegExp(`^${staticPattern}$`);
      
      const customPattern = customRoute.path
        .replace(/:[^/]+/g, '([^/]+)')
        .replace(/\//g, '\\/');
      const customRegex = new RegExp(`^${customPattern}$`);
      
      // Check if the routes would match the same paths
      return staticRegex.toString() === customRegex.toString();
    });
    
    return !shouldOverride;
  });

  // Now register the custom routes
  for (var customRoute of config.CustomAPI) {
    console.log(`Registering custom API route: ${customRoute.path}`);
    
    let func;
    if (typeof customRoute.func === 'function') {
      func = customRoute.func;
    } else {
      // Check if the function body contains await to determine if it should be async
      const isAsync = customRoute.func.includes('await ');
      
      if (isAsync) {
        // Create an async function
        const AsyncFunction = (async function () {}).constructor;
        func = new AsyncFunction('req', 'res', 'next', 'runtimeContext', customRoute.func);
      } else {
        func = new Function('req', 'res', 'next', 'runtimeContext', customRoute.func);
      }
    }

    // Register the route with proper error handling
    api.get(customRoute.path, (req, res, next) => {
      try {
        if (!runtimeContext) {
          res.status(500).json({ error: 'Runtime context not initialized' });
          return;
        }
        func(req, res, next, runtimeContext);
      } catch (error) {
        console.error(`Error in custom route ${customRoute.path}:`, error);
        next(error);
      }
    });
  }

  return true;
}

export function extractFunctionBody(funcString) {
  // Find the first '{' and the last '}'
  const bodyStart = funcString.indexOf('{');
  const bodyEnd = funcString.lastIndexOf('}');
  if (bodyStart === -1 || bodyEnd === -1 || bodyEnd <= bodyStart) {
    // Fallback or error handling if the format is unexpected
    console.warn("Could not extract function body from string:", funcString);
    return funcString; // Return original, might still error
  }
  // Extract the content between the first '{' and last '}'
  return funcString.substring(bodyStart + 1, bodyEnd).trim();
}

export function hotCustom(processor) {
  // Assuming CustomOperationsProcessing was intended here, like in hotOps.
  // Please confirm if CustomJsonProcessing is correct.
  let CJP_Source = config.CustomJsonProcessing;
  let CJP_Array = [];

  if (Array.isArray(CJP_Source)) {
    CJP_Array = CJP_Source;
  } else if (CJP_Source && typeof CJP_Source === 'object' && Object.keys(CJP_Source).length) {
    // Convert object to array
    for (var key in CJP_Source) {
      if (Object.hasOwnProperty.call(CJP_Source, key)) {
        CJP_Array.push(CJP_Source[key]);
      }
    }
    console.log("Converted CustomOperationsProcessing from object to array for hotCustom");
  } else {
    // It's neither an array nor a convertible object, likely empty or invalid
    return false;
  }

  for (var n = 0; n < CJP_Array.length; n++) {
    const customOp = CJP_Array[n];
    if (customOp.type == 'on' && customOp.op && customOp.func) {
      // Use the rehydrated module-level CodeShare and Every from the hot loader
      const contextWithLatestCodeShare = {
        ...runtimeContext,
        CodeShare, // Use module-level rehydrated CodeShare
        Every      // Use module-level rehydrated Every
      };
      
      // Debug logging for specific operations
      if (customOp.op === 'report') {
        console.log('Setting up report operation with CodeShare:', contextWithLatestCodeShare.CodeShare?.PoA?.Check ? 'AVAILABLE' : 'MISSING');
        console.log('Module CodeShare.PoA.Check type:', typeof CodeShare?.PoA?.Check);
      }
      
      processor.on(customOp.op, (json, from, active, pc) => {
        try {
          // Debug at execution time
          console.log(`Executing custom operation ${customOp.op} - CodeShare.PoA.Check available:`, typeof CodeShare?.PoA?.Check);
          
          // Make CodeShare and Every available as global variables in the eval context
          // by setting them in a temporary context and cleaning up after
          const originalCodeShare = global.CodeShare;
          const originalEvery = global.Every;
          
          global.CodeShare = CodeShare;
          global.Every = Every;
          
          try {
            eval('(' + customOp.func + ')')(json, from, active, pc, contextWithLatestCodeShare);
          } finally {
            // Clean up global assignments
            if (originalCodeShare !== undefined) {
              global.CodeShare = originalCodeShare;
            } else {
              delete global.CodeShare;
            }
            if (originalEvery !== undefined) {
              global.Every = originalEvery;
            } else {
              delete global.Every;
            }
          }
        } catch (e) {
          console.error(`Error executing custom on operation ${customOp.op}:`, e);
          pc[0](pc[2]); // Continue with error handling
        }
      });
    }
  }
}

export function hotOps(processor) {
  let COP_Source = config.CustomOperationsProcessing;
  let COP_Array = [];

  if (Array.isArray(COP_Source)) {
    COP_Array = COP_Source;
  } else if (COP_Source && typeof COP_Source === 'object' && Object.keys(COP_Source).length) {
    for (var key in COP_Source) {
       if (Object.hasOwnProperty.call(COP_Source, key)) {
          COP_Array.push(COP_Source[key]);
       }
    }
    console.log("Converted CustomOperationsProcessing from object to array for hotOps");
  } else {
      return true; 
  }
  if (!COP_Array.length) return true;

  for (var customOp of COP_Array) {
    if (!customOp || typeof customOp.func !== 'string') continue;
    const funcBody = extractFunctionBody(customOp.func);

    // func expects: json, from, active, pc, runtimeContext
    // Check if the function body contains await to determine if it should be async
    const isAsync = funcBody.includes('await ');
    let func;
    
    if (isAsync) {
      // Create an async function
      const AsyncFunction = (async function () {}).constructor;
      func = new AsyncFunction('json', 'pc', 'context', funcBody);
    } else {
      func = new Function('json', 'pc', 'context', funcBody);
    }

    // Processor.onOperation provides: json, from, active, pc
    // We call func with these + our runtimeContext
    processor.onOperation(customOp.op, (json, pc, context) => {
      try {
        return func(json, pc, context); // Pass runtimeContext from outer scope
      } catch (e) {
        console.error(`Error executing custom onOperation ${customOp.op}:`, e);
      }
    });
  }
  return true;
}

export function hotChron(chronOps) {
    let Chron_Source = config.CustomChron;
    let Chron_Array = [];

    if (Array.isArray(Chron_Source)) {
        Chron_Array = Chron_Source;
    } else if (Chron_Source && typeof Chron_Source === 'object' && Object.keys(Chron_Source).length) {
        // Convert object to array - Corrected loop
        for (var key in Chron_Source) {
            if (Object.hasOwnProperty.call(Chron_Source, key)) {
                Chron_Array.push(Chron_Source[key]);
            }
        }
        console.log("Converted CustomChron from object to array for hotChron");
    } else {
         return true; // Nothing to process
    }


    for (var customChronJob of Chron_Array) { // Iterate over the processed array
        customChronJob.function = customChronJob.func
        console.log('Registering customChronJob:', customChronJob.op)
        if (!customChronJob || typeof customChronJob.func !== 'function') {
          const funcBody = extractFunctionBody(customChronJob.func);
          // Check if the function body contains await to determine if it should be async
          const isAsync = funcBody.includes('await ');
          
          if (isAsync) {
            // Create an async function
            const AsyncFunction = (async function () {}).constructor;
            customChronJob.function = new AsyncFunction('b', 'passed', 'res', 'rej', 'num', 'prand', 'ints', 'bh', 'context', funcBody);
          } else {
            customChronJob.function = new Function('b', 'passed', 'res', 'rej', 'num', 'prand', 'ints', 'bh', 'context', funcBody);
          }
        }

        // Create a closure that captures the current customChronJob by value
        chronOps[customChronJob.op] = ((chronJob) => {
            return (b, passed, res, rej, num, prand, ints, bh, context) => {
                try {
                    return chronJob.function(b, passed, res, rej, num, prand, ints, bh, context);
                } catch (e) {
                    console.error(`Error executing custom chron job ${chronJob.op}:`, e);
                    // Chron jobs often need to resolve/reject, handle error appropriately
                    rej(e); // Example: reject the promise on error
                }
            };
        })(customChronJob);
    }
    return true;
}

export function hotConfig(newConfig, cleanState, api, chronOps, processor) {
  console.log('hotConfig called with newConfig:', newConfig ? Object.keys(newConfig) : 'null');
  if (!cleanState || !cleanState.stats) return;
  if (!newConfig) newConfig = cleanState.chain;
  
  // Update global config with newConfig from chain FIRST
  for (var n in newConfig) {
    config[n] = newConfig[n]; // This updates the global config object
  }

  // Now, specifically check for CodeShare and CustomEvery in the newConfig from chain
  let codeShareDefsFromChain = undefined; // Undefined means chain did not provide it
  let everyDefsFromChain = undefined; // Undefined means chain did not provide it

  // Handle CodeShare from chain: expect dehydrated function definitions
  if (newConfig.CodeShare) {
    if (typeof newConfig.CodeShare === 'string' && newConfig.CodeShare.length) {
      try {
        console.log('Attempting to JSON.parse config.CodeShare definitions from string');
        codeShareDefsFromChain = JSON.parse(newConfig.CodeShare);
        if (typeof codeShareDefsFromChain !== 'object' || codeShareDefsFromChain === null) codeShareDefsFromChain = {}; // Ensure it's an object
      } catch (e) { 
        console.error('Error JSON.parsing config.CodeShare definitions:', e);
        codeShareDefsFromChain = {}; 
      }
    } else if (newConfig.CodeShare && typeof newConfig.CodeShare === 'object') {
      // Already an object (potentially dehydrated definitions)
      codeShareDefsFromChain = newConfig.CodeShare;
      console.log('Using config.CodeShare object directly as definitions');
    }
  }

  // Handle CustomEvery from chain: expect dehydrated function definitions  
  if (newConfig.CustomEvery) {
    if (typeof newConfig.CustomEvery === 'string' && newConfig.CustomEvery.length) {
      try {
        console.log('Attempting to JSON.parse config.CustomEvery definitions from string');
        everyDefsFromChain = JSON.parse(newConfig.CustomEvery);
        if (!Array.isArray(everyDefsFromChain)) everyDefsFromChain = []; // Ensure it's an array
      } catch (e) {
        console.error('Error JSON.parsing config.CustomEvery definitions:', e);
        everyDefsFromChain = [];
      }
    } else if (Array.isArray(newConfig.CustomEvery)) {
      // Already an array (potentially dehydrated definitions)
      everyDefsFromChain = newConfig.CustomEvery;
      console.log('Using config.CustomEvery array directly as definitions');
    } else if (typeof newConfig.CustomEvery === 'object') {
      // Handle case where array is stored as object with numeric keys
      console.log('Converting CustomEvery object with numeric keys to array');
      everyDefsFromChain = [];
      const keys = Object.keys(newConfig.CustomEvery).sort((a, b) => parseInt(a) - parseInt(b));
      for (const key of keys) {
        if (!isNaN(parseInt(key))) {
          everyDefsFromChain.push(newConfig.CustomEvery[key]);
        }
      }
      console.log(`Converted ${keys.length} CustomEvery entries from object to array`);
    }
  }

  // Call customInit with rehydrated definitions (or undefined if not from chain)
  customInit(api, chronOps, processor, codeShareDefsFromChain, everyDefsFromChain)
    .then(() => {
      console.log('hotConfig and customInit completed successfully');
    })
    .catch((err) => {
      console.error('Error in hotConfig/customInit:', err);
    });
}

export function customInit(api, chron, processor, codeShareDefsFromChain, everyDefsFromChain) {
  return new Promise((resolve, reject) => {
    console.log('customInit called to rebuild CodeShare and Every from definitions');
    console.log('everyDefsFromChain:', everyDefsFromChain ? `Array with ${everyDefsFromChain.length} items` : 'undefined');

    const newCodeShare = {};
    
    // If we have definitions from chain, rehydrate them
    if (codeShareDefsFromChain && typeof codeShareDefsFromChain === 'object') {
      console.log('Rehydrating CodeShare from chain definitions...');
      rehydrateObjectRecursively(codeShareDefsFromChain, newCodeShare);
    } else {
      // Fall back to initial config.CodeShare if available
      if (config.CodeShare && typeof config.CodeShare === 'object') {
        console.log('Using initial config.CodeShare as fallback...');
        rehydrateObjectRecursively(config.CodeShare, newCodeShare);
      }
    }
    
    // Ensure Every is initialized before using HR.margins
    initializeEvery();
    const newEvery = [HR.margins, HR.witness_mod]; // Always start with HR.margins and HR.witness_mod
    
    // If we have definitions from chain, rehydrate them
    if (everyDefsFromChain && Array.isArray(everyDefsFromChain)) {
      console.log('Rehydrating CustomEvery from chain definitions...');
      for (const item of everyDefsFromChain) {
        if (typeof item === 'object' && item.functions) {
          // Handle new format with id and functions
          const rehydratedFunctions = [];
          rehydrateArrayOfFunctions(item.functions, rehydratedFunctions);
          newEvery.push(...rehydratedFunctions);
        } else if (typeof item === 'object' && item.params && item.body) {
          // Handle single function definition
          try {
            // Convert params to array if it's an object with numeric keys
            let paramsArray;
            if (Array.isArray(item.params)) {
              paramsArray = item.params;
            } else if (typeof item.params === 'object') {
              paramsArray = [];
              const paramKeys = Object.keys(item.params).sort((a, b) => parseInt(a) - parseInt(b));
              for (const pKey of paramKeys) {
                paramsArray.push(item.params[pKey]);
              }
            }
            const func = new Function(...paramsArray, item.body);
            newEvery.push(func);
            console.log(`Rehydrated CustomEvery function: ${item.name || 'anonymous'}`);
          } catch (e) {
            console.error('Error rehydrating CustomEvery function:', e, item);
          }
        }
      }
    } else {
      // If no definitions from chain and Every already has more than just margins, preserve it
      if (Every && Every.length > 2) {
        console.log('Preserving existing Every array with', Every.length, 'functions');
        // Copy existing functions except HR.margins and HR.witness_mod (first two)
        for (let i = 2; i < Every.length; i++) {
          newEvery.push(Every[i]);
        }
      } else if (config.CustomEvery && Array.isArray(config.CustomEvery)) {
        // Fall back to initial config.CustomEvery if available
        console.log('Using initial config.CustomEvery as fallback...');
        rehydrateArrayOfFunctions(config.CustomEvery, newEvery);
      }
    }

    // Update module-level variables
    CodeShare = newCodeShare;
    Every = newEvery;
    
    // Make CodeShare available globally for rehydrated functions
    globalThis.CodeShare = CodeShare;
    
    console.log('Final CodeShare after rehydration');
    console.log('Every after rehydration:', Every.length, 'functions');

    // Re-initialize context so it picks up the new CodeShare and Every
    if (runtimeContext && runtimeContext.store && runtimeContext.status && runtimeContext.VERSION) {
      initializeContext(processor, runtimeContext.store, runtimeContext.status, runtimeContext.VERSION);
      console.log('Context reinitialized with new CodeShare and Every');
    } else {
      console.warn('Cannot reinitialize context - runtimeContext not properly set');
    }

    resolve();
  });
}

// Helper function to rehydrate an object that may contain function definitions
function rehydrateObjectRecursively(source, target) {
  console.log('rehydrateObjectRecursively called with source keys:', Object.keys(source));
  
  // Handle path-based definitions (e.g., "nested.function": {params, body})
  for (const key in source) {
    if (Object.hasOwnProperty.call(source, key)) {
      const value = source[key];
      console.log(`Processing key: ${key}, value type: ${typeof value}`);
      
      if (typeof value === 'object' && value !== null && value.params && value.body && typeof value.body === 'string') {
        // This is a function definition - rehydrate it and place it at the correct path
        try {
          // Convert params object to array if needed
          let paramsArray = [];
          if (Array.isArray(value.params)) {
            paramsArray = value.params;
          } else if (typeof value.params === 'object') {
            // Convert object with numeric keys to array
            const keys = Object.keys(value.params).sort((a, b) => parseInt(a) - parseInt(b));
            paramsArray = keys.map(k => value.params[k]);
          }
          
          // Check if the function body contains await to determine if it should be async
          const isAsync = value.body.includes('await ');
          let func;
          
          if (isAsync) {
            // Create an async function
            const AsyncFunction = (async function () {}).constructor;
            // Check if CodeShare is already declared in the function (parameter or destructuring)
            const hasCodeShareParam = paramsArray.includes('CodeShare');
            const hasCodeShareDestructuring = /const\s*\{[^}]*CodeShare[^}]*\}\s*=/.test(value.body);
            const needsCodeShareInjection = !hasCodeShareParam && !hasCodeShareDestructuring;
            
            const funcBody = needsCodeShareInjection ? `
              const CodeShare = this.CodeShare || globalThis.CodeShare;
              ${value.body}
            ` : value.body;
            
            func = new AsyncFunction(...paramsArray, funcBody);
            // Bind CodeShare to the function's context if we injected it
            if (needsCodeShareInjection) {
              func = func.bind({ 
                get CodeShare() { return CodeShare; }
              });
            }
          } else {
            // Check if CodeShare is already declared in the function (parameter or destructuring)
            const hasCodeShareParam = paramsArray.includes('CodeShare');
            const hasCodeShareDestructuring = /const\s*\{[^}]*CodeShare[^}]*\}\s*=/.test(value.body);
            const needsCodeShareInjection = !hasCodeShareParam && !hasCodeShareDestructuring;
            
            const funcBody = needsCodeShareInjection ? `
              const CodeShare = this.CodeShare || globalThis.CodeShare;
              ${value.body}
            ` : value.body;
            
            func = new Function(...paramsArray, funcBody);
            // Bind CodeShare to the function's context if we injected it
            if (needsCodeShareInjection) {
              func = func.bind({ 
                get CodeShare() { return CodeShare; }
              });
            }
          }
          
          // Set the function at the correct nested path
          setNestedProperty(target, key, func);
          console.log(`Rehydrated ${isAsync ? 'async ' : ''}function at path: ${key}`);
        } catch (e) {
          console.error(`Error rehydrating function ${key}:`, e, value);
          setNestedProperty(target, key, () => { console.error(`Function ${key} failed to rehydrate`); });
        }
      } else if (typeof value === 'object' && value !== null) {
        // This might be a nested object with more definitions - recurse if it doesn't look like a function definition
        if (!key.includes('.')) {
          target[key] = {};
          rehydrateObjectRecursively(value, target[key]);
        }
      } else {
        // This is a primitive value - copy directly
        target[key] = value;
      }
    }
  }
}

// Helper function to set a property at a nested path like "PoA.Check"
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  // Navigate to the parent object, creating nested objects as needed
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  
  // Set the final property
  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;
}

// Helper function to rehydrate an array that may contain function definitions
function rehydrateArrayOfFunctions(source, target) {
  for (const item of source) {
    if (typeof item === 'object' && item !== null && item.params && item.body) {
      try {
        // Check if the function body contains await to determine if it should be async
        const isAsync = item.body.includes('await ');
        let func;
        
        if (isAsync) {
          // Create an async function
          const AsyncFunction = (async function () {}).constructor;
          func = new AsyncFunction(...item.params, item.body);
        } else {
          func = new Function(...item.params, item.body);
        }
        
        target.push(func);
      } catch (e) {
        console.error('Error rehydrating function from array:', e, item);
      }
    } else if (typeof item === 'function') {
      target.push(item); // Already a live function
    }
  }
} 