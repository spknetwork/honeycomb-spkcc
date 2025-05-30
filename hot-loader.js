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
export var Every = [HR.margins, ...(config.CustomEvery || [])];

export function initializeContext(processorToUse, storeToUse, statusToUse, versionToUse) {
  // Make a copy of config for runtimeContext.config, excluding sensitive keys.
  const configCopy = { ...config }; // global config is updated by hotConfig
  delete configCopy.active;
  delete configCopy.msowner;

  runtimeContext = { 
    store: storeToUse,
    config: configCopy, 
    fetch, WebSocket, API, 
    VERSION: versionToUse, 
    getPathObj, getPathNum, getPathSome, RAM, 
    burn, forceCancel, add, addc, addMT, addCol, addGov, deletePointer, credit, nodeUpdate, penalty, chronAssign, hashThis, isEmpty, postToDiscord, 
    Base64, Base58, Base38, stringify, NFT, Chron, stringify, DEX, naizer, 
    status: statusToUse, 
    verifySig, 
    CodeShare, // Uses the current module-level CodeShare
    Every,     // Uses the current module-level Every
    processor: processorToUse 
  };

  // Detailed logging for CodeShare structure
  const codeShareExists = !!CodeShare;
  const poaExists = codeShareExists && typeof CodeShare.PoA === 'object' && CodeShare.PoA !== null;
  const checkExists = poaExists && typeof CodeShare.PoA.Check === 'function';
  console.log(`runtimeContext initialized/updated. CodeShare defined: ${codeShareExists}. CodeShare.PoA object exists: ${poaExists}. CodeShare.PoA.Check is function: ${checkExists}`);
  if (codeShareExists && !poaExists) {
    try { console.log('CodeShare content (keys):', JSON.stringify(Object.keys(CodeShare))); } catch(e){ console.log('CodeShare content: (unstringifiable)');}
  }
  if (poaExists && !checkExists) {
    try { console.log('CodeShare.PoA content (keys):', JSON.stringify(Object.keys(CodeShare.PoA))); } catch(e){ console.log('CodeShare.PoA content: (unstringifiable)');}
  }
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
    
    const func = typeof customRoute.func === 'function' 
      ? customRoute.func 
      : new Function('req', 'res', 'next', 'runtimeContext', customRoute.func);

    // Register the route with proper error handling
    api.get(customRoute.path, (req, res, next) => {
      try {
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

  // Debug the CodeShare structure
  console.log('hotCustom - Module-level CodeShare:', CodeShare);
  console.log('hotCustom - CodeShare.PoA:', CodeShare?.PoA);
  console.log('hotCustom - CodeShare.PoA.Check:', CodeShare?.PoA?.Check);
  console.log('hotCustom - runtimeContext.CodeShare:', runtimeContext?.CodeShare);
  console.log('hotCustom - runtimeContext.CodeShare.PoA:', runtimeContext?.CodeShare?.PoA);

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
    const func = new Function('json', 'pc', 'context', funcBody);

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
          customChronJob.function = new Function('b', 'passed', 'res', 'rej', 'num', 'prand', 'ints', 'bh', 'context', funcBody); 
        }

        chronOps[customChronJob.op] = (b, passed, res, rej, num, prand, ints, bh, context) => {
            try {
                return customChronJob.function(b, passed, res, rej, num, prand, ints, bh, context);
            } catch (e) {
                console.error(`Error executing custom chron job ${customChronJob.op}:`, e);
                // Chron jobs often need to resolve/reject, handle error appropriately
                rej(e); // Example: reject the promise on error
            }
        };
    }
    return true;
}

export function hotConfig(newConfig, cleanState, api, chronOps, processor) {
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
    console.log('codeShareDefsFromChain:', codeShareDefsFromChain);

    const newCodeShare = {};
    
    // If we have definitions from chain, rehydrate them
    if (codeShareDefsFromChain && typeof codeShareDefsFromChain === 'object') {
      console.log('Rehydrating CodeShare from chain definitions...');
      console.log('Available definition keys:', Object.keys(codeShareDefsFromChain));
      rehydrateObjectRecursively(codeShareDefsFromChain, newCodeShare);
      console.log('Rehydrated CodeShare structure:', newCodeShare);
      console.log('Rehydrated CodeShare.PoA:', newCodeShare.PoA);
      console.log('Rehydrated CodeShare.PoA.Check type:', typeof newCodeShare.PoA?.Check);
    } else {
      // Fall back to initial config.CodeShare if available
      if (config.CodeShare && typeof config.CodeShare === 'object') {
        console.log('Using initial config.CodeShare as fallback...');
        console.log('config.CodeShare.PoA.Check type:', typeof config.CodeShare.PoA?.Check);
        rehydrateObjectRecursively(config.CodeShare, newCodeShare);
      }
    }
    
    const newEvery = [HR.margins]; // Always start with HR.margins
    
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
            const func = new Function(...item.params, item.body);
            newEvery.push(func);
          } catch (e) {
            console.error('Error rehydrating CustomEvery function:', e, item);
          }
        }
      }
    } else {
      // Fall back to initial config.CustomEvery if available
      if (config.CustomEvery && Array.isArray(config.CustomEvery)) {
        console.log('Using initial config.CustomEvery as fallback...');
        rehydrateArrayOfFunctions(config.CustomEvery, newEvery);
      }
    }

    // Update module-level variables
    CodeShare = newCodeShare;
    Every = newEvery;
    
    console.log('Final CodeShare after rehydration:', CodeShare);
    console.log('Final CodeShare.PoA:', CodeShare.PoA);
    console.log('Final CodeShare.PoA.Check type:', typeof CodeShare.PoA?.Check);
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
  for (const key in source) {
    if (Object.hasOwnProperty.call(source, key)) {
      const value = source[key];
      console.log(`Processing key: ${key}, value type: ${typeof value}`);
      if (typeof value === 'object' && value !== null) {
        if (value.params && value.body && Array.isArray(value.params) && typeof value.body === 'string') {
          // This is a function definition - rehydrate it
          try {
            target[key] = new Function(...value.params, value.body);
            console.log(`Rehydrated function: ${key}`);
          } catch (e) {
            console.error(`Error rehydrating function ${key}:`, e, value);
            target[key] = () => { console.error(`Function ${key} failed to rehydrate`); };
          }
        } else {
          // This is a nested object - recurse
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

// Helper function to rehydrate an array that may contain function definitions
function rehydrateArrayOfFunctions(source, target) {
  for (const item of source) {
    if (typeof item === 'object' && item !== null && item.params && item.body) {
      try {
        const func = new Function(...item.params, item.body);
        target.push(func);
      } catch (e) {
        console.error('Error rehydrating function from array:', e, item);
      }
    } else if (typeof item === 'function') {
      target.push(item); // Already a live function
    }
  }
} 