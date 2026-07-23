import process from 'node:process';
import {start as startBot, stop as stopBot} from './bot/index.ts';
import {feedTheDragons} from './magic.ts';
import {createShutdownHandler, type ShutdownSignal} from './shutdown.ts';

feedTheDragons();

const shutdown = createShutdownHandler({
	onError(error) {
		console.error('Could not stop the bot cleanly', error);
	},
	onSignal(signal) {
		console.log(`${signal} received, stopping the bot`);
	},
	setExitCode(code) {
		process.exitCode = code;
	},
	stop: stopBot,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const satisfies readonly ShutdownSignal[]) {
	process.once(signal, () => {
		void shutdown(signal);
	});
}

await startBot();
