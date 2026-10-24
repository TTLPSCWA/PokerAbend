# Pokerabend – Texas Hold'em für die Freundesgruppe
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY engine ./engine
COPY server ./server
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server/index.js"]
