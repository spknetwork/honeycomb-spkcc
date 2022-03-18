FROM node:14

WORKDIR /honeycomb

COPY package.json .

RUN npm install

COPY  ["./.env", "./config.js", "./dao.js", "./discord.js", "./docker-start.js", "./edb.js", "./enforce.js", "./getPathObj.js", "./helpers.js", "./hive.js", "./index.js", "./ipfsSaveState.js", "./lil_ops.js", "./msa.js", "./pathwise.js", "./processor.js", "./report.js", "./rtrades.js", "./state.js", "./tally.js", "./voter.js", "./"]

COPY ./processing_routes ./processing_routes/

COPY ./routes ./routes/

CMD ["node", "docker-start.js"]
