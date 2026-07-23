import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createShutdownHandler} from './shutdown.ts';

await test('stops once when multiple shutdown signals arrive', async () => {
	const signals: string[] = [];
	let stopCalls = 0;
	const shutdown = createShutdownHandler({
		onError(error) {
			assert.fail(`Unexpected shutdown error: ${String(error)}`);
		},
		onSignal(signal) {
			signals.push(signal);
		},
		setExitCode(code) {
			assert.fail(`Unexpected exit code: ${code}`);
		},
		async stop() {
			stopCalls++;
		},
	});

	await Promise.all([
		shutdown('SIGTERM'),
		shutdown('SIGINT'),
	]);

	assert.equal(stopCalls, 1);
	assert.deepEqual(signals, ['SIGTERM']);
});

await test('reports shutdown failures and sets a failing exit code', async () => {
	const errors: unknown[] = [];
	const exitCodes: number[] = [];
	const expectedError = new Error('stop failed');
	const shutdown = createShutdownHandler({
		onError(error) {
			errors.push(error);
		},
		onSignal() {
			return undefined;
		},
		setExitCode(code) {
			exitCodes.push(code);
		},
		async stop() {
			throw expectedError;
		},
	});

	await shutdown('SIGTERM');

	assert.deepEqual(errors, [expectedError]);
	assert.deepEqual(exitCodes, [1]);
});
