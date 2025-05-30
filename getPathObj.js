import { store } from "./index.mjs"

export const getPathObj = function (path) {
    return new Promise(function(resolve, reject) {
        store.get(path, function(err, obj) {
            if (err) {
                console.log(path)
                resolve({});
            } else {
                resolve(obj);
            }
        });
    });
}

export const getPathNum = function (path) {
    return new Promise(function(resolve, reject) {
        store.get(path, function(err, obj) {
            if (err) {
                reject(err);
            } else {
                if (typeof obj != 'number') {
                    resolve(0);
                } else {
                    resolve(obj);
                }
            }
        });
    });
}

export const getPathSome = function (path, arg) {
    return new Promise(function(resolve, reject) {
        store.someChildren(path, arg, function(err, obj) {
            if (err) {
                reject(err);
                resolve({})
            } else {
                resolve(obj);
            }
        });
    });
}

export const deleteObjs = (paths) => {
    return new Promise((resolve, reject) => {
        var ops = [];
        for (var i = 0; i < paths.length; i++) {
            ops.push({ type: 'del', path: paths[i] });
        }
        store.batch(ops, [resolve, reject, paths.length]);
    })
}
