FROM docker.io/library/alpine:3.22 AS builder
RUN apk upgrade --no-cache \
	&& apk add --no-cache npm ffmpeg python3 py3-pip
RUN pip3 install --break-system-packages yt-dlp gallery-dl
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --no-update-notifier --ignore-scripts
COPY . ./
RUN node_modules/.bin/tsc


FROM docker.io/library/alpine:3.22 AS packages
RUN apk upgrade --no-cache \
	&& apk add --no-cache npm ffmpeg python3 py3-pip
RUN pip3 install --break-system-packages yt-dlp gallery-dl
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --no-update-notifier --omit=dev --ignore-scripts


FROM docker.io/library/alpine:3.22 AS final
RUN apk upgrade --no-cache \
	&& apk add --no-cache nodejs ffmpeg python3 py3-pip
RUN pip3 install --break-system-packages yt-dlp gallery-dl

WORKDIR /app
VOLUME /app/persist

COPY package.json ./
COPY --from=packages /build/node_modules ./node_modules
COPY locales locales
COPY --from=builder /build/dist ./

ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["telegram-typescript-bot-template.js"]
