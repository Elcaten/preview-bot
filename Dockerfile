FROM docker.io/library/node:22-bookworm-slim AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --no-update-notifier --ignore-scripts
COPY tsconfig.json ./
COPY source source
RUN node_modules/.bin/tsc


FROM docker.io/library/node:22-bookworm-slim AS packages
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --no-update-notifier --omit=dev --ignore-scripts


FROM docker.io/friedrichrehren/yt-dlp:latest AS final

USER root
WORKDIR /app
VOLUME /app/sessions

RUN mkdir -p /app/sessions \
	&& chown -R 65532:65532 /app

COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --chown=65532:65532 package.json ./
COPY --chown=65532:65532 --from=packages /build/node_modules ./node_modules
COPY --chown=65532:65532 locales locales
COPY --chown=65532:65532 --from=builder /build/dist ./

USER 65532
ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["telegram-typescript-bot-template.js"]
