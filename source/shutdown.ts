export type ShutdownSignal = 'SIGINT' | 'SIGTERM';

type ShutdownHandlerOptions = {
	onError: (error: unknown) => void;
	onSignal: (signal: ShutdownSignal) => void;
	setExitCode: (code: number) => void;
	stop: () => Promise<void>;
};

export function createShutdownHandler(options: ShutdownHandlerOptions): (
	signal: ShutdownSignal
) => Promise<void> {
	let shutdownPromise: Promise<void> | undefined;

	return async signal => {
		if (!shutdownPromise) {
			options.onSignal(signal);
			shutdownPromise = options.stop();
		}

		try {
			await shutdownPromise;
		} catch (error) {
			options.onError(error);
			options.setExitCode(1);
		}
	};
}
