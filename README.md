# Preview Bot

Telegram bot that downloads videos from Instagram links and sends them back as
playable Telegram videos. X links are currently rewritten to `nitter.net`.

The production image uses
[`friedrichrehren/yt-dlp:latest`](https://hub.docker.com/r/friedrichrehren/yt-dlp),
which includes yt-dlp, FFmpeg, and the supporting runtime tools.

## Requirements

- Node.js 22 or newer
- A Telegram bot token from
  [@BotFather](https://t.me/BotFather)
- yt-dlp and FFmpeg on `PATH` when running without Docker

## Local development

Install dependencies and create the local configuration:

```bash
npm ci
cp .env.example .env
```

Set `BOT_TOKEN` in `.env`, then start the bot:

```bash
npm start
```

Run the compiler, linter, and tests with:

```bash
npm test
```

Session files are created under `sessions/`.

## Docker

Build the image:

```bash
docker build -t preview-bot .
```

Run it with persistent Telegram sessions:

```bash
docker run --rm \
  --env BOT_TOKEN \
  --volume preview-bot-sessions:/app/sessions \
  preview-bot
```

The container runs as a non-root user. Temporary Instagram downloads are
removed after each Telegram upload or failure.

## Configuration

Only `BOT_TOKEN` is required.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `BOT_TOKEN` | required | Telegram bot token |
| `YTDLP_BINARY_PATH` | `yt-dlp` | yt-dlp executable path |
| `INSTAGRAM_COOKIES_FILE` | unset | Optional Netscape-format cookies file |
| `INSTAGRAM_DOWNLOAD_CONCURRENCY` | `2` | Simultaneous download workflows |
| `INSTAGRAM_DOWNLOAD_QUEUE_SIZE` | `10` | Requests allowed to wait |
| `INSTAGRAM_QUEUE_TIMEOUT_MS` | `30000` | Maximum queue wait |
| `INSTAGRAM_DOWNLOAD_TIMEOUT_MS` | `120000` | Maximum yt-dlp runtime |
| `INSTAGRAM_MAX_VIDEOS` | `10` | Maximum carousel videos |

Numeric settings are validated at startup. The bot limits output to 49 MB per
video so it remains below Telegram's bot upload limit.

### Optional Instagram cookies

Public Instagram posts should be tried without cookies first. If authentication
is necessary, mount a cookies file read-only and point the bot to it:

```bash
docker run --rm \
  --env BOT_TOKEN \
  --env INSTAGRAM_COOKIES_FILE=/run/secrets/instagram-cookies.txt \
  --volume /absolute/path/instagram-cookies.txt:/run/secrets/instagram-cookies.txt:ro \
  --volume preview-bot-sessions:/app/sessions \
  preview-bot
```

Treat the cookies file as a password: do not commit it, include it in an image,
or expose it in logs.

## Supported Instagram behavior

- Standard URLs and Telegram text links
- Reels and single-video posts
- Up to ten videos from carousel posts
- MP4 output with streaming playback
- Replies attached to the original Telegram message
- Clear errors for private, missing, oversized, rate-limited, or timed-out
  content
