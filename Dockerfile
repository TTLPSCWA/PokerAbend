# Spieleabend – Spielesammlung für die Freundesgruppe (Image-Name bleibt „pokerabend“)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY games ./games
# Enthält beim CI-Build auch den erzeugten Roadmap-Buildnachweis. Git-Historie bleibt im Checkout.
COPY server ./server
COPY public ./public
# Kuratierte Besucher-Roadmap (ROADMAP-02): wird zur Laufzeit von games/public-roadmap.js gelesen
COPY docs/roadmap/public-roadmap.json ./docs/roadmap/public-roadmap.json

# Commit-Hash des Builds, sichtbar unter „Ich“ und auf /health (docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) .).
# Bewusst erst nach den Installations-Schichten, damit ein neuer Commit den Abhängigkeits-Cache nicht ungültig macht.
ARG GIT_COMMIT=unbekannt
ENV APP_COMMIT=$GIT_COMMIT

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server/index.js"]
