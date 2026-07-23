import assert from 'node:assert/strict';
import {
	mkdtemp,
	rm,
	truncate,
	writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {InstagramDownloadError} from './instagram-downloader.ts';
import {
	handleInstagramUrl,
	instagramErrorMessage,
	type InstagramVideoDownloader,
} from './instagram-handler.ts';

const instagramUrl = new URL('https://instagram.com/reel/example/');

await test('uploads downloaded videos in order', async () => {
	const temporaryDirectory = await mkdtemp(join(tmpdir(), 'preview-bot-handler-'));
	const firstVideo = join(temporaryDirectory, 'first.mp4');
	const secondVideo = join(temporaryDirectory, 'second.mp4');
	await Promise.all([
		writeFile(firstVideo, 'first'),
		writeFile(secondVideo, 'second'),
	]);
	const events: string[] = [];
	const downloader: InstagramVideoDownloader = async (_url, useVideos) => {
		await useVideos([firstVideo, secondVideo]);
	};

	try {
		await handleInstagramUrl(instagramUrl, {
			async sendText(text) {
				events.push(`text:${text}`);
			},
			async sendVideo(path) {
				events.push(`video:${path}`);
			},
			async showUploadActivity() {
				events.push('activity');
			},
		}, downloader);

		assert.deepEqual(events, [
			'activity',
			'activity',
			`video:${firstVideo}`,
			'activity',
			`video:${secondVideo}`,
		]);
	} finally {
		await rm(temporaryDirectory, {force: true, recursive: true});
	}
});

await test('does not upload a video larger than the safe Telegram limit', async () => {
	const temporaryDirectory = await mkdtemp(join(tmpdir(), 'preview-bot-handler-'));
	const videoPath = join(temporaryDirectory, 'large.mp4');
	await writeFile(videoPath, '');
	await truncate(videoPath, (49 * 1024 * 1024) + 1);
	const videos: string[] = [];
	const messages: string[] = [];
	const downloader: InstagramVideoDownloader = async (_url, useVideos) => {
		await useVideos([videoPath]);
	};

	try {
		await handleInstagramUrl(instagramUrl, {
			async sendText(text) {
				messages.push(text);
			},
			async sendVideo(path) {
				videos.push(path);
			},
			async showUploadActivity() {
				return undefined;
			},
		}, downloader);

		assert.deepEqual(videos, []);
		assert.deepEqual(messages, [
			'This Instagram video is too large to send through Telegram.',
		]);
	} finally {
		await rm(temporaryDirectory, {force: true, recursive: true});
	}
});

await test('returns a useful message for yt-dlp failures', async () => {
	const messages: string[] = [];
	const downloader: InstagramVideoDownloader = async () => {
		throw new InstagramDownloadError('download-failed', 'failed');
	};

	await handleInstagramUrl(instagramUrl, {
		async sendText(text) {
			messages.push(text);
		},
		async sendVideo() {
			return undefined;
		},
		async showUploadActivity() {
			return undefined;
		},
	}, downloader);

	assert.deepEqual(messages, [
		'I could not download this Instagram video. It may be private, unavailable, or rate-limited.',
	]);
});

await test('maps timeout and empty-post errors', () => {
	assert.equal(
		instagramErrorMessage(new InstagramDownloadError('busy', 'busy')),
		'The bot is busy downloading other videos. Please try again shortly.',
	);
	assert.equal(
		instagramErrorMessage(new InstagramDownloadError('timeout', 'timed out')),
		'Instagram took too long to provide this video. Please try again.',
	);
	assert.equal(
		instagramErrorMessage(new InstagramDownloadError('no-video', 'empty')),
		'I could not find a video in this Instagram post.',
	);
});
