import { Webhook, MessageBuilder } from 'discord-webhook-node'
import { Config, TXID } from "./index.mjs";
import fetch from 'node-fetch'
const hook = Config("hookurl") ? new Webhook(Config("hookurl")) : null

export const contentToDiscord = (author, permlink) => {
    let params = [author, permlink];
    let method = 'condenser_api.get_content'
    let body = {
        jsonrpc: "2.0",
        method,
        params,
        id: 1
    };
    fetch(Config("clientURL"), {
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            method: "POST"
        })
        .then(j => j.json())
        .then(result => {
            r = result.result
            const embed = new MessageBuilder()
                .setTitle(`New ${Config("TOKEN")} content!`)
                .setAuthor(author, 'https://cdn.discordapp.com/embed/avatars/0.png', `https://${Config("mainFE")}/@${author}`)
                .setURL(`https://${Config("mainFE")}/${Config("tag")}/@${author}/${permlink}`)
                .addField(r.title, (JSON.parse(r.json_metadata).description || `View this on ${Config("mainFE")}`), true)
                //.addField('Second field', 'this is not inline')
                .setColor('#00b0f4')
                //.setThumbnail('https://cdn.discordapp.com/embed/avatars/0.png')
                //.setDescription('Oh look a description :)')
                //.setImage('https://cdn.discordapp.com/embed/avatars/0.png')
                //.setFooter('Hey its a footer', 'https://cdn.discordapp.com/embed/avatars/0.png')
                .setTimestamp();

            hook.send(embed)
                .catch(e => console.log(e))
        }).catch(e => { console.log(e) })

}

export const renderNFTtoDiscord = (script, uid, owner, set) => {
    const embed = new MessageBuilder()
                .setTitle(`New ${set} NFT minted!`)
                .setAuthor(owner, 'https://cdn.discordapp.com/embed/avatars/0.png', `https://${Config("mainFE")}/@${owner}`)
                .setURL(`https://${Config("mainFE")}/@${owner}#inventory/`)
                .addField(`${set}:${uid}`, `View this on ${Config("mainFE")}`, true)
                //.addField('Second field', 'this is not inline')
                .setColor('#00b0f4')
                //.setThumbnail('https://cdn.discordapp.com/embed/avatars/0.png')
                //.setDescription('Oh look a description :)')
                .setImage(`https://${Config("mainRender")}/render/${script}/${uid}`)
                //.setFooter('Hey its a footer', 'https://cdn.discordapp.com/embed/avatars/0.png')
                .setTimestamp();

            hook.send(embed)
                .catch(e => console.log(e))

}

//export contentToDiscord('disregardfiat', 'dlux-development-update-jan-15')

export const postToDiscord = (msg, id) => {
    if(Config("hookurl"))hook.send(msg)
    if(Config("status"))TXID.store(msg, id)
}

//great place to build a feed function to edb