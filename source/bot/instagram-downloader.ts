import {execFile} from 'node:child_process';
import {
	mkdtemp,
	realpath,
	rm,
	stat,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {
	isAbsolute,
	join,
	relative,
	resolve,
} from 'node:path';
import {env} from 'node:process';
import {promisify} from 'node:util';
import {readInstagramDownloadConfig} from './instagram-config.ts';
import {
	createTaskLimiter,
	type TaskLimiter,
	TaskLimitError,
} from './task-limiter.ts';
import {isInstagramUrl} from './urls.ts';

const execFileAsync = promisify(execFile);

const maximumOutputBytes = 1024 * 1024;

type DefaultRuntime = {
	config: ReturnType<typeof readInstagramDownloadConfig>;
	limiter: TaskLimiter;
};

let defaultRuntime: DefaultRuntime | undefined;

function createDefaultRuntime(): DefaultRuntime {
	const config = readInstagramDownloadConfig(env);
	return {
		config,
		limiter: createTaskLimiter(
			config.concurrency,
			config.maximumQueued,
			config.queueTimeoutMilliseconds,
		),
	};
}

function getDefaultRuntime(): DefaultRuntime {
	defaultRuntime ??= createDefaultRuntime();
	return defaultRuntime;
}

export function configureInstagramDownloader(): void {
	defaultRuntime = createDefaultRuntime();
}

type DownloadErrorCode
	= 'busy' | 'download-failed' | 'no-video' | 'timeout' | 'unsafe-output' | 'unsupported-url';

export class InstagramDownloadError extends Error {
	readonly code: DownloadErrorCode;

	constructor(code: DownloadErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'InstagramDownloadError';
		this.code = code;
	}
}

type ProcessOutput = {
	stdout: string;
	stderr: string;
};

export type YtDlpRunner = (
	binaryPath: string,
	arguments_: readonly string[],
	timeoutMilliseconds: number,
) => Promise<ProcessOutput>;

type DownloadOptions = {
	binaryPath?: string;
	cookiesFilePath?: string;
	limiter?: TaskLimiter;
	maximumFiles?: number;
	runner?: YtDlpRunner;
	temporaryRoot?: string;
	timeoutMilliseconds?: number;
};

async function runYtDlp(
	binaryPath: string,
	arguments_: readonly string[],
	timeoutMilliseconds: number,
): Promise<ProcessOutput> {
	const {stdout, stderr} = await execFileAsync(binaryPath, [...arguments_], {
		encoding: 'utf8',
		killSignal: 'SIGKILL',
		maxBuffer: maximumOutputBytes,
		timeout: timeoutMilliseconds,
	});

	return {stdout, stderr};
}

export function createYtDlpArguments(
	outputDirectory: string,
	url: URL,
	maximumFiles = getDefaultRuntime().config.maximumFiles,
	cookiesFilePath?: string,
): string[] {
	return [
		'--ignore-config',
		'--no-progress',
		'--restrict-filenames',
		'--format',
		'best[ext=mp4]/best',
		'--merge-output-format',
		'mp4',
		'--remux-video',
		'mp4',
		'--max-filesize',
		'49M',
		'--playlist-items',
		`1:${maximumFiles}`,
		'--output',
		join(outputDirectory, '%(id)s.%(ext)s'),
		'--print',
		'after_move:filepath',
		...(cookiesFilePath ? ['--cookies', cookiesFilePath] : []),
		'--',
		url.toString(),
	];
}

function isTimeoutError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const processError = error as Error & {code?: unknown; killed?: unknown};
	return processError.killed === true || processError.code === 'ETIMEDOUT';
}

async function validateOutputPaths(
	outputDirectory: string,
	stdout: string,
	maximumFiles: number,
): Promise<string[]> {
	const reportedPaths = stdout
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);

	if (reportedPaths.length === 0) {
		throw new InstagramDownloadError('no-video', 'yt-dlp did not produce a video');
	}

	if (reportedPaths.length > maximumFiles) {
		throw new InstagramDownloadError('unsafe-output', 'yt-dlp produced too many files');
	}

	const realOutputDirectory = await realpath(outputDirectory);
	return Promise.all(reportedPaths.map(async reportedPath => {
		const candidatePath = isAbsolute(reportedPath)
			? reportedPath
			: resolve(outputDirectory, reportedPath);
		const realCandidatePath = await realpath(candidatePath);
		const relativePath = relative(realOutputDirectory, realCandidatePath);
		const fileStat = await stat(realCandidatePath);

		if (
			relativePath === ''
			|| relativePath.startsWith('..')
			|| isAbsolute(relativePath)
			|| !fileStat.isFile()
		) {
			throw new InstagramDownloadError(
				'unsafe-output',
				'yt-dlp reported a file outside its temporary directory',
			);
		}

		return realCandidatePath;
	}));
}

export async function withDownloadedInstagramVideos<Result>(
	url: URL,
	useVideos: (videoPaths: readonly string[]) => Promise<Result>,
	options: DownloadOptions = {},
): Promise<Result> {
	if (!isInstagramUrl(url)) {
		throw new InstagramDownloadError(
			'unsupported-url',
			'Only Instagram URLs can be downloaded',
		);
	}

	const runtime = getDefaultRuntime();
	const maximumFiles = options.maximumFiles ?? runtime.config.maximumFiles;
	const timeoutMilliseconds
		= options.timeoutMilliseconds ?? runtime.config.timeoutMilliseconds;
	const runner = options.runner ?? runYtDlp;
	try {
		return await (options.limiter ?? runtime.limiter).run(async () => {
			const outputDirectory = await mkdtemp(join(
				options.temporaryRoot ?? tmpdir(),
				'preview-bot-instagram-',
			));

			try {
				let output: ProcessOutput;
				try {
					output = await runner(
						options.binaryPath ?? runtime.config.binaryPath,
						createYtDlpArguments(
							outputDirectory,
							url,
							maximumFiles,
							options.cookiesFilePath ?? runtime.config.cookiesFilePath,
						),
						timeoutMilliseconds,
					);
				} catch (error) {
					if (isTimeoutError(error)) {
						throw new InstagramDownloadError(
							'timeout',
							'Instagram download timed out',
							{cause: error},
						);
					}

					throw new InstagramDownloadError(
						'download-failed',
						'yt-dlp could not download the Instagram video',
						{cause: error},
					);
				}

				const videoPaths = await validateOutputPaths(
					outputDirectory,
					output.stdout,
					maximumFiles,
				);
				return await useVideos(videoPaths);
			} finally {
				await rm(outputDirectory, {force: true, recursive: true});
			}
		});
	} catch (error) {
		if (error instanceof TaskLimitError) {
			throw new InstagramDownloadError(
				'busy',
				'Instagram download capacity is currently full',
				{cause: error},
			);
		}

		throw error;
	}
}
