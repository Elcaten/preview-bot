import assert from 'node:assert/strict';
import {
	access,
	mkdtemp,
	readdir,
	realpath,
	rm,
	writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {
	createYtDlpArguments,
	InstagramDownloadError,
	withDownloadedInstagramVideos,
	type YtDlpRunner,
} from './instagram-downloader.ts';

const instagramUrl = new URL('https://www.instagram.com/reel/example/');

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function outputPathFromArguments(arguments_: readonly string[]): string {
	const outputIndex = arguments_.indexOf('--output');
	assert.notEqual(outputIndex, -1);
	const outputTemplate = arguments_[outputIndex + 1];
	assert.ok(outputTemplate);
	return outputTemplate.replace('%(id)s.%(ext)s', 'example.mp4');
}

await test('builds safe yt-dlp arguments', () => {
	const arguments_ = createYtDlpArguments(
		'/tmp/download',
		new URL('https://instagram.com/reel/--exec/'),
		3,
	);

	assert.deepEqual(arguments_.slice(-2), [
		'--',
		'https://instagram.com/reel/--exec/',
	]);
	assert.equal(arguments_.includes('1:3'), true);
	assert.equal(arguments_.includes('49M'), true);
	assert.equal(arguments_.includes('best[ext=mp4]/best'), true);
	assert.equal(arguments_.includes('--remux-video'), true);
});

await test('passes an optional Instagram cookies file to yt-dlp', () => {
	const arguments_ = createYtDlpArguments(
		'/tmp/download',
		instagramUrl,
		3,
		'/run/secrets/instagram-cookies.txt',
	);
	const cookiesIndex = arguments_.indexOf('--cookies');

	assert.notEqual(cookiesIndex, -1);
	assert.equal(
		arguments_[cookiesIndex + 1],
		'/run/secrets/instagram-cookies.txt',
	);
	assert.equal(arguments_[cookiesIndex + 2], '--');
});

await test('rejects non-Instagram URLs before running yt-dlp', async () => {
	let didRun = false;
	const runner: YtDlpRunner = async () => {
		didRun = true;
		return {stdout: '', stderr: ''};
	};

	await assert.rejects(
		withDownloadedInstagramVideos(
			new URL('https://example.com/video/'),
			async () => undefined,
			{runner},
		),
		(error: unknown) => {
			assert.ok(error instanceof InstagramDownloadError);
			assert.equal(error.code, 'unsupported-url');
			return true;
		},
	);
	assert.equal(didRun, false);
});

await test('provides downloaded videos and removes them afterwards', async () => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'preview-bot-test-'));
	let downloadedPath: string | undefined;
	const runner: YtDlpRunner = async (_binaryPath, arguments_) => {
		downloadedPath = outputPathFromArguments(arguments_);
		await writeFile(downloadedPath, 'video');
		return {stdout: `${downloadedPath}\n`, stderr: ''};
	};

	try {
		const result = await withDownloadedInstagramVideos(
			instagramUrl,
			async videoPaths => {
				assert.ok(downloadedPath);
				assert.deepEqual(videoPaths, [await realpath(downloadedPath)]);
				const [videoPath] = videoPaths;
				assert.ok(videoPath);
				assert.equal(await pathExists(videoPath), true);
				return 'sent';
			},
			{runner, temporaryRoot},
		);

		assert.equal(result, 'sent');
		await assert.rejects(access(downloadedPath!));
	} finally {
		await rm(temporaryRoot, {force: true, recursive: true});
	}
});

await test('removes temporary files when the consumer fails', async () => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'preview-bot-test-'));
	let downloadedPath: string | undefined;
	const runner: YtDlpRunner = async (_binaryPath, arguments_) => {
		downloadedPath = outputPathFromArguments(arguments_);
		await writeFile(downloadedPath, 'video');
		return {stdout: downloadedPath, stderr: ''};
	};

	try {
		await assert.rejects(
			withDownloadedInstagramVideos(
				instagramUrl,
				async () => {
					throw new Error('upload failed');
				},
				{runner, temporaryRoot},
			),
			/upload failed/,
		);
		await assert.rejects(access(downloadedPath!));
	} finally {
		await rm(temporaryRoot, {force: true, recursive: true});
	}
});

await test('reports timeouts and removes the temporary directory', async () => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'preview-bot-test-'));
	const timeoutError = Object.assign(new Error('timed out'), {killed: true});
	const runner: YtDlpRunner = async () => {
		throw timeoutError;
	};

	try {
		await assert.rejects(
			withDownloadedInstagramVideos(
				instagramUrl,
				async () => undefined,
				{runner, temporaryRoot},
			),
			(error: unknown) => {
				assert.ok(error instanceof InstagramDownloadError);
				assert.equal(error.code, 'timeout');
				return true;
			},
		);
		assert.deepEqual(await readdir(temporaryRoot), []);
	} finally {
		await rm(temporaryRoot, {force: true, recursive: true});
	}
});

await test('rejects files reported outside the temporary directory', async () => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), 'preview-bot-test-'));
	const outsidePath = join(temporaryRoot, 'outside.mp4');
	await writeFile(outsidePath, 'video');
	const runner: YtDlpRunner = async () => ({stdout: outsidePath, stderr: ''});

	try {
		await assert.rejects(
			withDownloadedInstagramVideos(
				instagramUrl,
				async () => undefined,
				{runner, temporaryRoot},
			),
			(error: unknown) => {
				assert.ok(error instanceof InstagramDownloadError);
				assert.equal(error.code, 'unsafe-output');
				return true;
			},
		);
	} finally {
		await rm(temporaryRoot, {force: true, recursive: true});
	}
});
