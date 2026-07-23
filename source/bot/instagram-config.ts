type Environment = Record<string, string | undefined>;

type IntegerSetting = {
	defaultValue: number;
	maximum: number;
	minimum: number;
	name: string;
};

export type InstagramDownloadConfig = {
	binaryPath: string;
	concurrency: number;
	cookiesFilePath?: string;
	maximumFiles: number;
	maximumQueued: number;
	queueTimeoutMilliseconds: number;
	timeoutMilliseconds: number;
};

function integerSetting(
	environment: Environment,
	setting: IntegerSetting,
): number {
	const value = environment[setting.name];
	if (value === undefined) {
		return setting.defaultValue;
	}

	if (!/^\d+$/.test(value)) {
		throw new Error(`${setting.name} must be an integer`);
	}

	const parsedValue = Number(value);
	if (parsedValue < setting.minimum || parsedValue > setting.maximum) {
		throw new Error(`${setting.name} must be between ${setting.minimum} and ${setting.maximum}`);
	}

	return parsedValue;
}

export function readInstagramDownloadConfig(environment: Environment): InstagramDownloadConfig {
	const configuredBinaryPath = environment['YTDLP_BINARY_PATH']?.trim();
	const configuredCookiesFilePath = environment['INSTAGRAM_COOKIES_FILE']?.trim();
	const binaryPath = configuredBinaryPath === undefined || configuredBinaryPath === ''
		? 'yt-dlp'
		: configuredBinaryPath;
	const cookiesFilePath = configuredCookiesFilePath === ''
		? undefined
		: configuredCookiesFilePath;

	return {
		binaryPath,
		concurrency: integerSetting(environment, {
			defaultValue: 2,
			maximum: 10,
			minimum: 1,
			name: 'INSTAGRAM_DOWNLOAD_CONCURRENCY',
		}),
		cookiesFilePath,
		maximumFiles: integerSetting(environment, {
			defaultValue: 10,
			maximum: 10,
			minimum: 1,
			name: 'INSTAGRAM_MAX_VIDEOS',
		}),
		maximumQueued: integerSetting(environment, {
			defaultValue: 10,
			maximum: 100,
			minimum: 0,
			name: 'INSTAGRAM_DOWNLOAD_QUEUE_SIZE',
		}),
		queueTimeoutMilliseconds: integerSetting(environment, {
			defaultValue: 30_000,
			maximum: 300_000,
			minimum: 1000,
			name: 'INSTAGRAM_QUEUE_TIMEOUT_MS',
		}),
		timeoutMilliseconds: integerSetting(environment, {
			defaultValue: 120_000,
			maximum: 600_000,
			minimum: 10_000,
			name: 'INSTAGRAM_DOWNLOAD_TIMEOUT_MS',
		}),
	};
}
