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
export var CodeShare = {};
export var Every = [HR.margins];

export function initializeContext(processor, store, status, VERSION) {
  // make a copy of config and leave out any private keys
  const configCopy = { ...config };
  delete configCopy.active;
  delete configCopy.msowner;
  CodeShare = config.CodeShare || {}
  if(config?.CustomEvery?.length)Every = [HR.margins, ...config.CustomEvery]
  else Every = [HR.margins]
  runtimeContext = { store, config: configCopy, fetch, WebSocket, API, VERSION, getPathObj, getPathNum, getPathSome, RAM, burn, forceCancel, add, addc, addMT, addCol, addGov, deletePointer, credit, nodeUpdate, penalty, chronAssign, hashThis, isEmpty, postToDiscord, Base64, Base58, Base38, stringify, NFT, Chron, stringify, DEX, naizer, status, verifySig, CodeShare, processor }
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

export function customInit(api, chron, processor, CS, E) {
  return new Promise((resolve, reject) => {
    console.log('customInit called with new CodeShare and Every')
    // Update module-level CodeShare and Every with the evaluated versions
    if (CS && typeof CS === 'object') {
      CodeShare = CS;
    } else {
      CodeShare = {}; // Default to empty object if CS is invalid
    }
    if (E && Array.isArray(E)) {
      Every = [HR.margins, ...E]; // Always include HR.margins, then add from E
    } else {
      Every = [HR.margins]; // Default if E is invalid
    }

    // Re-initialize context so it picks up the new CodeShare and Every
    if (runtimeContext && runtimeContext.store && runtimeContext.status && runtimeContext.VERSION) {
        initializeContext(processor, runtimeContext.store, runtimeContext.status, runtimeContext.VERSION);
    } else {
        // Fallback or initial setup if runtimeContext or its properties are not fully there
        // This might need adjustment based on when customInit can be called relative to initial initializeContext
        console.warn('runtimeContext or its properties not fully available for re-initialization in customInit. Full context re-init might be needed elsewhere or first.');
        // Attempt a basic re-init. THIS IS A GUESS and might need specific store, status, VERSION values if this path is hit.
        // initializeContext(processor, undefined, undefined, undefined); // Or some defaults
    }

    hotAPI(api)
    hotChron(chron)
    hotCustom(processor) //hotCustom uses runtimeContext, which should now be updated
    hotOps(processor)    //hotOps uses runtimeContext, which should now be updated
    resolve()
  })
}

export function hotConfig(newConfig, cleanState, api, chronOps, processor) {
  if (!cleanState || !cleanState.stats) return
  if (!newConfig) newConfig = cleanState.chain
  for (var n in newConfig) {
    config[n] = newConfig[n]
  }

  // Handle CodeShare: if it's a string, eval it. Ensure it's an object.
  if (newConfig.CodeShare) { // Check if CodeShare was part of the update an needs processing
    if (typeof config.CodeShare === 'string' && config.CodeShare.length) {
      try {
        console.log('Attempting to eval config.CodeShare from string');
        config.CodeShare = eval('(' + config.CodeShare + ')');
      } catch (e) { 
        console.error('Error eval-ing config.CodeShare:', e); 
        // If eval fails, retain the string if it was one, or initialize if it became something else
        if (typeof config.CodeShare !== 'object') config.CodeShare = {}; 
      }
    }
  }
  // Ensure config.CodeShare is an object, defaulting to empty if not properly set or not an object.
  if (!config.CodeShare || typeof config.CodeShare !== 'object') {
    config.CodeShare = {};
  }

  // Handle CustomEvery: if it's a string, eval it. Ensure it's an array.
  if (newConfig.CustomEvery) { // Check if CustomEvery was part of the update and needs processing
    if (typeof config.CustomEvery === 'string' && config.CustomEvery.length) {
      try {
        console.log('Attempting to eval config.CustomEvery from string');
        config.CustomEvery = eval('(' + config.CustomEvery + ')');
      } catch (e) { 
        console.error('Error eval-ing config.CustomEvery:', e);
        // If eval fails, retain the string if it was one, or initialize if it became something else
        if (!Array.isArray(config.CustomEvery)) config.CustomEvery = [];
      }
    }
  }
  // Ensure config.CustomEvery is an array, defaulting to empty if not properly set or not an array.
  if (!Array.isArray(config.CustomEvery)) {
    config.CustomEvery = [];
  }

  // Parse other custom configurations if they are strings (these expect func bodies as strings)
  if (typeof config.customAPI === 'string') config.customAPI = config.customAPI.length ? JSON.parse(config.customAPI) : "NA"
  if (typeof config.CustomJsonProcessing === 'string') config.CustomJsonProcessing = config.CustomJsonProcessing.length ? JSON.parse(config.CustomJsonProcessing) : "NA"
  if (typeof config.CustomOperationsProcessing === 'string') config.CustomOperationsProcessing = config.CustomOperationsProcessing.length ? JSON.parse(config.CustomOperationsProcessing) : "NA"
  if (typeof config.CustomChron === 'string') config.CustomChron = config.CustomChron.length ? JSON.parse(config.CustomChron) : "NA"
  // Note: CustomEvery was handled above with eval, so no JSON.parse here for it.
  // Note: CodeShare was handled above with eval, so no JSON.parse here for it.
  
  customInit(api, chronOps, processor, config.CodeShare, config.CustomEvery);
} 