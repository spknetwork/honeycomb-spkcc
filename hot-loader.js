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

export function initializeContext(processor, store, status, VERSION) {
  // Make a copy of config for runtimeContext.config, excluding sensitive keys.
  const configCopy = { ...config };
  delete configCopy.active;
  delete configCopy.msowner;
  // runtimeContext will use the module-level CodeShare and Every, 
  // which are managed either by initial load or by customInit.
  runtimeContext = { store, config: configCopy, fetch, WebSocket, API, VERSION, getPathObj, getPathNum, getPathSome, RAM, burn, forceCancel, add, addc, addMT, addCol, addGov, deletePointer, credit, nodeUpdate, penalty, chronAssign, hashThis, isEmpty, postToDiscord, Base64, Base58, Base38, stringify, NFT, Chron, stringify, DEX, naizer, status, verifySig, CodeShare, Every, processor };
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
    return true; // Nothing to process
  }

  for (var customOp of CJP_Array) {
    if (!customOp || typeof customOp.func !== 'string') continue; // Skip if invalid

    const funcBody = extractFunctionBody(customOp.func);
    const func = typeof customOp.func === 'function' ? // Check if it was already a function (unlikely if loaded from config string)
      customOp.func :
      new Function('json', 'from', 'active', 'pc', 'context', funcBody); // Use extracted body

    // Ensure processor[customOp.type] exists before assigning
    
       processor[customOp.type](customOp.op, (json, from, active, pc, context) => {
         try {
             return func(json, from, active, pc, runtimeContext);
         } catch (e) {
             console.error(`Error executing custom operation ${customOp.op} (type ${customOp.type}):`, e);
             // Decide how to handle errors, maybe return a default or throw
         }
       });
  }
  return true;
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

export function customInit(api, chron, processor, codeShareDefs, everyDefs) {
  return new Promise((resolve, reject) => {
    console.log('customInit called to rebuild CodeShare and Every from definitions');

    const newCodeShare = {};
    if (codeShareDefs && typeof codeShareDefs === 'object') {
      for (const path in codeShareDefs) {
        if (Object.hasOwnProperty.call(codeShareDefs, path)) {
          const def = codeShareDefs[path];
          if (def && typeof def.body === 'string' && Array.isArray(def.params)) {
            try {
              const func = new Function(...def.params, def.body);
              // Handle nested paths like "PoA.Check"
              const parts = path.split('.');
              let current = newCodeShare;
              for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = current[parts[i]] || {};
                current = current[parts[i]];
              }
              current[parts[parts.length - 1]] = func;
            } catch (e) {
              console.error(`Error creating function for CodeShare path ${path}:`, e);
            }
          }
        }
      }
    }
    CodeShare = newCodeShare; // Replace module-level CodeShare

    const newEvery = [HR.margins]; // Always start with HR.margins
    if (Array.isArray(everyDefs)) {
      for (const def of everyDefs) {
        if (def && typeof def.body === 'string' && Array.isArray(def.params)) {
          try {
            const func = new Function(...def.params, def.body);
            newEvery.push(func);
          } catch (e) {
            console.error(`Error creating function for CustomEvery definition:`, def.name || 'unnamed', e);
          }
        }
      }
    }
    Every = newEvery; // Replace module-level Every

    // Re-initialize context so it picks up the newly built CodeShare and Every
    if (runtimeContext && runtimeContext.store && runtimeContext.status && runtimeContext.VERSION !== undefined && runtimeContext.processor !== undefined) {
        initializeContext(runtimeContext.processor, runtimeContext.store, runtimeContext.status, runtimeContext.VERSION);
    } else {
        console.warn('runtimeContext or its key properties not fully available for re-initialization in customInit. Attempting re-init with current processor from args.');
        // This fallback may be needed if customInit is called before runtimeContext is fully populated from an initial start.
        // It assumes processor passed to customInit is the correct one to use.
        // The store, status, VERSION might be missing initially here, leading to partial context if this path is hit early.
        initializeContext(processor, runtimeContext?.store, runtimeContext?.status, runtimeContext?.VERSION);
    }

    hotAPI(api);       // Uses config, which is updated directly in hotConfig
    hotChron(chron);   // Uses config
    hotCustom(processor); // Uses runtimeContext (now rebuilt with new CodeShare/Every)
    hotOps(processor);    // Uses runtimeContext (now rebuilt with new CodeShare/Every)
    resolve();
  });
}

export function hotConfig(newConfig, cleanState, api, chronOps, processor) {
  if (!cleanState || !cleanState.stats) return;
  if (!newConfig) newConfig = cleanState.chain;
  for (var n in newConfig) {
    config[n] = newConfig[n];
  }

  let codeShareDefs = {};
  let everyDefs = [];

  // Handle CodeShare from chain: expect a JSON string of definitions
  if (newConfig.CodeShare && typeof newConfig.CodeShare === 'string' && newConfig.CodeShare.length) {
    try {
      console.log('Attempting to JSON.parse config.CodeShare definitions from string');
      codeShareDefs = JSON.parse(newConfig.CodeShare);
      if (typeof codeShareDefs !== 'object' || codeShareDefs === null) codeShareDefs = {}; // Ensure it's an object
    } catch (e) { 
      console.error('Error JSON.parsing config.CodeShare definitions:', e);
      codeShareDefs = {}; 
    }
  } else if (newConfig.CodeShare && typeof newConfig.CodeShare === 'object') {
    // If it's already an object (e.g. from initial config load not through chain), use it as definitions
    // This path might be less common if chain always provides strings
    codeShareDefs = newConfig.CodeShare;
  }

  // Handle CustomEvery from chain: expect a JSON string of an array of definitions
  if (newConfig.CustomEvery && typeof newConfig.CustomEvery === 'string' && newConfig.CustomEvery.length) {
    try {
      console.log('Attempting to JSON.parse config.CustomEvery definitions from string');
      everyDefs = JSON.parse(newConfig.CustomEvery);
      if (!Array.isArray(everyDefs)) everyDefs = []; // Ensure it's an array
    } catch (e) { 
      console.error('Error JSON.parsing config.CustomEvery definitions:', e);
      everyDefs = [];
    }
  } else if (Array.isArray(newConfig.CustomEvery)) {
    // If it's already an array, use as definitions
    everyDefs = newConfig.CustomEvery;
  }

  // Parse other custom configurations that expect string function bodies
  if (typeof config.CustomAPI === 'string') config.CustomAPI = config.CustomAPI.length ? JSON.parse(config.CustomAPI) : "NA";
  if (typeof config.CustomJsonProcessing === 'string') config.CustomJsonProcessing = config.CustomJsonProcessing.length ? JSON.parse(config.CustomJsonProcessing) : "NA";
  if (typeof config.CustomOperationsProcessing === 'string') config.CustomOperationsProcessing = config.CustomOperationsProcessing.length ? JSON.parse(config.CustomOperationsProcessing) : "NA";
  if (typeof config.CustomChron === 'string') config.CustomChron = config.CustomChron.length ? JSON.parse(config.CustomChron) : "NA";
  
  customInit(api, chronOps, processor, codeShareDefs, everyDefs);
} 