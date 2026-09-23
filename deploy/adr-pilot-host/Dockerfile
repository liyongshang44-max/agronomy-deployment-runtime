FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY . .

EXPOSE 3000

CMD ["node", "deploy/adr-pilot-host/server.mjs"]
