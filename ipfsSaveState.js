import { ipfs, store } from "./index.mjs"
import { of as createHash } from "ipfs-only-hash";

export const ipfsHash = (num, buffer, initiator = null, state = null) => {
  return new Promise(async (resolve, reject) => {
    const hash = await createHash(buffer);
    if (initiator && state) {
      state.stats.pendingHash = hash
      state.stats.pendingBlock = num
      store.batch([
        {
          type: "put",
          path: ['stats', 'pendingHash'],
          data: hash
        },
        {
          type: "put",
          path: ['stats', 'pendingBlock'],
          data: num
        }
      ], [initiator, reject, state])
    } else {
      store.batch([
        {
          type: "put",
          path: ['stats', 'pendingHash'],
          data: hash
        },
        {
          type: "put",
          path: ['stats', 'pendingBlock'],
          data: num
        }
      ], [resolve, reject, { hash, num }])
    }
  });
}

export const ipfsSaveState = (blocknum, buffer, ipfsc, tries) => {
  return new Promise((resolve, reject) => {
    if (tries) console.log("Retry IPFS Save:", tries);
    ipfs.add(buffer, (err, ipfs_return) => {
      if (!err) {
        var hash = "";
        try {
          hash = ipfs_return[0].hash;
        } catch (e) {
          console.log(e);
        }
        console.log(blocknum + `:Saved: ${hash}`);
        resolve({
          hashLastIBlock: hash,
          hashBlock: blocknum,
        });
      } else {
        reject(err);
        /*
                    cycleipfs(cycle++)
                    if (cycle >= 25) {
                        cycle = 0;
                        return;
                    }
                    */
      }
    });
  });
};

export const ipfsPeerConnect = (peerid) => {
  return new Promise((resolve, reject) => {
    //ipfs.swarm.addrs().then((addrs) => {console.log(addrs)})
    ipfs.swarm.connect(`/p2p/${peerid}`, (err, res) => {
      if (res) resolve(res.Strings[0]);
      if (err) {
        resolve(`Failed to connect to${peerid}`);
      }
    });
  });
};