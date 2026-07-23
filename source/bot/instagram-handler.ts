import {stat} from 'node:fs/promises';
import {
	InstagramDownloadError,
	withDownloadedInstagramVideos,
} from './instagram-downloader.ts';

const maximumTelegramVideoBytes = 49 * 1024 * 1024;

type InstagramActions = {
	reportError?: (error: unknown) => void;
	sendText: (text: string) => Promise<unknown>;
	sendVideo: (path: string) => Promise<unknown>;
	showUploadActivity: () => Promise<unknown>;
};

export type InstagramVideoDownloader = (
	url: URL,
	useVideos: (videoPaths: readonly string[]) => Promise<void>,
) => Promise<void>;

class InstagramUploadError extends Error {
	constructor() {
		super('Instagram video exceeds the Telegram upload limit');
		this.name = 'InstagramUploadError';
	}
}

async function sendVideos(
	videoPaths: readonly string[],
	actions: InstagramActions,
	index = 0,
): Promise<void> {
	const videoPath = videoPaths[index];
	if (!videoPath) {
		return;
	}

	const videoStat = await stat(videoPath);
	if (videoStat.size > maximumTelegramVideoBytes) {
		throw new InstagramUploadError();
	}

	await actions.showUploadActivity();
	await actions.sendVideo(videoPath);
	await sendVideos(videoPaths, actions, index + 1);
}

export function instagramErrorMessage(error: unknown): string {
	if (error instanceof InstagramUploadError) {
		return 'This Instagram video is too large to send through Telegram.';
	}

	if (error instanceof InstagramDownloadError) {
		switch (error.code) {
			case 'busy': {
				return 'The bot is busy downloading other videos. Please try again shortly.';
			}

			case 'timeout': {
				return 'Instagram took too long to provide this video. Please try again.';
			}

			case 'no-video': {
				return 'I could not find a video in this Instagram post.';
			}

			case 'download-failed': {
				return 'I could not download this Instagram video. It may be private, unavailable, or rate-limited.';
			}

			case 'unsafe-output':
			case 'unsupported-url': {
				return 'I could not process this Instagram link.';
			}
		}
	}

	return 'I downloaded the Instagram video, but Telegram could not accept it.';
}

export async function handleInstagramUrl(
	url: URL,
	actions: InstagramActions,
	downloader: InstagramVideoDownloader = withDownloadedInstagramVideos,
): Promise<void> {
	try {
		await actions.showUploadActivity();
		await downloader(url, async videoPaths => sendVideos(videoPaths, actions));
	} catch (error) {
		actions.reportError?.(error);
		await actions.sendText(instagramErrorMessage(error));
	}
}
