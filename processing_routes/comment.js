import { store, Config } from "../index.mjs"
import { chronAssign } from './../lil_ops.js'
import { getPathObj } from '../getPathObj.js'
import { contentToDiscord } from './../discord.js'
import { insertNewPost, updateRating, moderate } from './../edb.js'

export const comment = (json, pc) => {
    let meta = {}
    try { meta = JSON.parse(json.json_metadata) } catch (e) {}
    if (json.author == Config("leader") && parseInt(json.permlink.split(Config("tag"))[1]) > json.block_num - 31000) {
        console.log('leader post')
        store.get(['escrow', json.author], function(e, a) {
            if (!e) {
                var ops = []
                for (var b in a) {
                    if (a[b][1].permlink == json.permlink && b == 'comment') {
                        ops.push({ type: 'del', path: ['escrow', json.author, b] })
                    }
                }
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            } else {
                console.log(e)
            }
        })
    } else if (Config("features").pob && meta.arHash || meta.vrHash || meta.appHash || meta.audHash) {
        Ppost = getPathObj(['posts', `${json.author}/${json.permlink}`])
        Promise.all([Ppost])
            .then(postarray => {
                post = postarray[0]
                var ops = []
                if (!Object.keys(post).length) { //check if promoted/voted
                    //store json until a vote or promote with comment options
                    ops.push({
                        type: 'put',
                        path: ['pend', `${json.author}/${json.permlink}`],
                        data: {
                            author: json.author,
                            permlink: json.permlink,
                            block_num: json.block_num,
                            meta
                        }
                    })
                    ops.push({
                        type: 'put',
                        path: ['chrono', `${json.block_num + 28800}:pend:${json.author}/${json.permlink}`],
                        data: {
                            author: json.author,
                            permlink: json.permlink,
                            block_num: json.block_num,
                            op: 'del_pend'
                        }
                    })
                } else {
                    post.meta = meta
                    ops.push({
                        type: 'put',
                        path: ['posts', `${json.author}/${json.permlink}`],
                        data: post
                    })
                }
                if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                store.batch(ops, pc)
            })
            .catch(e => { console.log(e) })
            
    } else if (Config("features").pob && (Config("features").pobTag && meta.tags.includes(Config("tag")))) {
        var assigns = []
                    assigns.push(chronAssign(json.block_num + 201600, {
                        block: parseInt(json.block_num + 201600),
                        op: 'post_reward',
                        author: json.author,
                        permlink: json.permlink
                    }))
                    assigns.push(chronAssign(parseInt(json.block_num + 20000), {
                        block: parseInt(json.block_num + 20000),
                        op: 'post_vote',
                        author: json.author,
                        permlink: json.permlink
                    }))
                    ops.push({
                        type: 'put',
                        path: ['posts', `${json.author}/${json.permlink}`],
                        data: {
                            block: json.block_num,
                            author: json.author,
                            permlink: json.permlink,
                            customJSON: a.meta
                        }
                    })
                    if(Config("dbcs")){
                        var type = "Blog";
                        for(var typeDef in Config("typeDefs")){
                            if(Config("typeDefs")[typeDef].includes(a.meta.vrHash)){
                                type = typeDef;
                                break;
                            }

                        }
                        if(type == "Blog"){
                        if (
                          a.meta.vrHash
                        )
                          type = "VR";
                        else if (
                          a.meta.arHash
                        )
                          type = "AR";
                        else if (
                          a.meta.appHash
                        )
                          type = "APP";
                        else if (
                          a.meta.audHash
                        )
                          type = "Audio";
                        else if (
                          a.meta.vidHash
                        )
                          type = "Video";
                    }
                        insertNewPost({
                            block: json.block_num,
                            author: json.author,
                            permlink: json.permlink,
                            type: type,
                        })
                    }
                    const msg = `@${json.author}|${json.permlink} added to ${Config("TOKEN")} rewardable content`
                    if (Config("hookurl")) contentToDiscord(json.author, json.permlink)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    Promise.all(assigns)
                    .then(v=>{
                        store.batch(ops, pc)
                    })
    } else if (
      Config("dbcs") && json.parent_author &&
      json.parent_permlink &&
      meta?.review?.rating &&
        meta.review.rating >= 1 &&
        meta.review.rating <= 5
    ) {
      updateRating(
        json.parent_author,
        json.parent_permlink,
        json.author,
        meta.review.rating
      );
      pc[0](pc[2]);
    } else if (
      Config("dbcs") &&
      Config("dbmods").includes(json.author) &&
      json.parent_author &&
      json.parent_permlink &&
      meta?.review?.moderate 
    ) {
        moderate(
          meta?.review?.moderate.hide,
          meta?.review?.moderate.reason,
          json.parent_author,
          json.parent_permlink
        );
      pc[0](pc[2]);
    } else {
      pc[0](pc[2]);
    }
}

export const comment_options = (json, pc) => {
    //console.log(json)
    try {
        var filter = json.extensions[0][1].beneficiaries
    } catch (e) {
        pc[0](pc[2])
        return
    }
    var ops = []
    for (var i = 0; i < filter.length; i++) {
        if (filter[i].account == Config("ben") && filter[i].weight >= Config("delegationWeight") ) {
            store.get(['pend', `${json.author}/${json.permlink}`], function(e, a) {
                if (e) { console.log(e) }
                if (Object.keys(a).length) {
                    var assigns = []
                    assigns.push(chronAssign(json.block_num + 201600, {
                        block: parseInt(json.block_num + 201600),
                        op: 'post_reward',
                        author: json.author,
                        permlink: json.permlink
                    }))
                    assigns.push(chronAssign(parseInt(json.block_num + 20000), {
                        block: parseInt(json.block_num + 20000),
                        op: 'post_vote',
                        author: json.author,
                        permlink: json.permlink
                    }))
                    ops.push({
                        type: 'put',
                        path: ['posts', `${json.author}/${json.permlink}`],
                        data: {
                            block: json.block_num,
                            author: json.author,
                            permlink: json.permlink,
                            customJSON: a.meta
                        }
                    })
                    if(Config("dbcs")){
                        var type = "Blog";
                        for(var typeDef in Config("typeDefs")){
                            if(Config("typeDefs")[typeDef].includes(a.meta.vrHash)){
                                type = typeDef;
                                break;
                            }

                        }
                        if(type == "Blog"){
                        if (
                          a.meta.vrHash
                        )
                          type = "VR";
                        else if (
                          a.meta.arHash
                        )
                          type = "AR";
                        else if (
                          a.meta.appHash
                        )
                          type = "APP";
                        else if (
                          a.meta.audHash
                        )
                          type = "Audio";
                        else if (
                          a.meta.vidHash
                        )
                          type = "Video";
                    }
                        insertNewPost({
                            block: json.block_num,
                            author: json.author,
                            permlink: json.permlink,
                            type: type,
                        })
                    }
                    ops.push({ type: 'del', path: ['pend', `${json.author}/${json.permlink}`] })
                    ops.push({ type: 'del', path: ['chrono', `${a.block_num + 28800}:pend:${json.author}/${json.permlink}`] })
                    const msg = `@${json.author}|${json.permlink} added to ${Config("TOKEN")} rewardable content`
                    if (Config("hookurl")) contentToDiscord(json.author, json.permlink)
                    ops.push({ type: 'put', path: ['feed', `${json.block_num}:${json.transaction_id}`], data: msg })
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    Promise.all(assigns)
                    .then(v=>{
                        store.batch(ops, pc)
                    })
                } else {
                    ops.push({ type: 'del', path: ['pend', `${json.author}/${json.permlink}`] })
                    ops.push({ type: 'del', path: ['chrono', `${a.block_num + 28800}:pend:${json.author}/${json.permlink}`] })
                    if (process.env.npm_lifecycle_event == 'test') pc[2] = ops
                    store.batch(ops, pc)
                }
            })
        } else {
            pc[0](pc[2])
        }
    }
}