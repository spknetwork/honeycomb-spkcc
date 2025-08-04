import { Config, hiveClient } from './index.mjs'

export const Hive = {
  getOwners: function (account) {
    return new Promise(function (resolve, reject) {
      hiveClient.api.setOptions({ url: Config("startURL") });
      hiveClient.api.getAccounts([account], function (err, result) {
        hiveClient.api.setOptions({ url: Config("clientURL") });
        if (err) {
          reject(err);
          return;
        }
        if (!result || !Array.isArray(result) || result.length === 0) {
          reject(new Error('Invalid API response: expected non-empty array but got ' + typeof result));
          return;
        }
        if (!result[0] || !result[0].active || !result[0].active.account_auths) {
          reject(new Error('Invalid account data structure in API response'));
          return;
        }
        resolve(result[0].active.account_auths);
      });
    });
  },
  getAccounts: function (accounts) {
    return new Promise(function (resolve, reject) {
      hiveClient.api.setOptions({ url: Config("startURL") });
      hiveClient.api.getAccounts(accounts, function (err, result) {
        hiveClient.api.setOptions({ url: Config("clientURL") });
        if (err) {
          reject(err);
          return;
        }
        if (!result || !Array.isArray(result)) {
          reject(new Error('Invalid API response: expected array but got ' + typeof result));
          return;
        }
        resolve(result);
      });
    });
  },
  getRecentReport: function (account, walletOperationsBitmask) {
    return new Promise(function (resolve, reject) {
      hiveClient.api.setOptions({ url: "https://api.deathwing.me/" });
      hiveClient.api.getAccountHistory(
        account,
        -1,
        100,
        ...walletOperationsBitmask,
        function (err, result) {
          hiveClient.api.setOptions({ url: Config("clientURL") });
          if (err) {
            reject(err);
            return;
          }
          if (!result || !Array.isArray(result)) {
            reject(new Error('Invalid API response: expected array but got ' + typeof result));
            return;
          }
          for(var i = 0; i < result.length;i++){
          }
          let ebus = result.filter(
              (tx) => tx[1].op[1].id === `${Config("prefix")}report`
            ),
            recents = [];
          for (var i = ebus.length - 1; i >= 0; i--) {
            if (
              JSON.parse(ebus[i][1].op[1].json).hash &&
              parseInt(JSON.parse(ebus[i][1].op[1].json).block) >
                parseInt(Config("override"))
            ) {
              recents.push([
                JSON.parse(ebus[i][1].op[1].json).hash,
                JSON.parse(ebus[i][1].op[1].json).block,
              ]);
            }
          }
          resolve(recents.shift());
        }
      );
    });
  },
};