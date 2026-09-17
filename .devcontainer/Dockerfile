FROM mcr.microsoft.com/devcontainers/typescript-node:1-22

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
	&& chmod a+rx /usr/local/bin/yt-dlp
