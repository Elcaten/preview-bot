import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readInstagramDownloadConfig} from './instagram-config.ts';

await test('uses safe Instagram download defaults', () => {
	assert.deepEqual(readInstagramDownloadConfig({}), {
		binaryPath: 'yt-dlp',
		concurrency: 2,
		cookiesFilePath: undefined,
		maximumFiles: 10,
		maximumQueued: 10,
		queueTimeoutMilliseconds: 30_000,
		timeoutMilliseconds: 120_000,
	});
});

await test('reads Instagram download settings', () => {
	assert.deepEqual(readInstagramDownloadConfig({
		INSTAGRAM_COOKIES_FILE: ' /run/secrets/instagram-cookies.txt ',
		INSTAGRAM_DOWNLOAD_CONCURRENCY: '3',
		INSTAGRAM_DOWNLOAD_QUEUE_SIZE: '20',
		INSTAGRAM_DOWNLOAD_TIMEOUT_MS: '180000',
		INSTAGRAM_MAX_VIDEOS: '5',
		INSTAGRAM_QUEUE_TIMEOUT_MS: '45000',
		YTDLP_BINARY_PATH: ' /usr/local/bin/yt-dlp ',
	}), {
		binaryPath: '/usr/local/bin/yt-dlp',
		concurrency: 3,
		cookiesFilePath: '/run/secrets/instagram-cookies.txt',
		maximumFiles: 5,
		maximumQueued: 20,
		queueTimeoutMilliseconds: 45_000,
		timeoutMilliseconds: 180_000,
	});
});

await test('rejects invalid Instagram download settings', () => {
	assert.throws(
		() => readInstagramDownloadConfig({INSTAGRAM_DOWNLOAD_CONCURRENCY: '0'}),
		/INSTAGRAM_DOWNLOAD_CONCURRENCY must be between 1 and 10/,
	);
	assert.throws(
		() => readInstagramDownloadConfig({INSTAGRAM_DOWNLOAD_TIMEOUT_MS: 'later'}),
		/INSTAGRAM_DOWNLOAD_TIMEOUT_MS must be an integer/,
	);
	assert.throws(
		() => readInstagramDownloadConfig({INSTAGRAM_MAX_VIDEOS: '11'}),
		/INSTAGRAM_MAX_VIDEOS must be between 1 and 10/,
	);
});
