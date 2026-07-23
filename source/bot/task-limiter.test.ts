import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import {test} from 'node:test';
import {
	createTaskLimiter,
	TaskLimitError,
} from './task-limiter.ts';

function deferred(): {
	promise: Promise<void>;
	resolve: () => void;
} {
	let resolvePromise: (() => void) | undefined;
	const promise = new Promise<void>(resolve => {
		resolvePromise = resolve;
	});

	return {
		promise,
		resolve() {
			resolvePromise?.();
		},
	};
}

await test('limits concurrent tasks and preserves queue order', async () => {
	const limiter = createTaskLimiter(2, 2, 1000);
	const first = deferred();
	const second = deferred();
	const events: string[] = [];
	const firstRun = limiter.run(async () => {
		events.push('first-start');
		await first.promise;
		events.push('first-end');
	});
	const secondRun = limiter.run(async () => {
		events.push('second-start');
		await second.promise;
		events.push('second-end');
	});
	const thirdRun = limiter.run(async () => {
		events.push('third-start');
	});

	await wait(10);
	assert.deepEqual(events, ['first-start', 'second-start']);
	first.resolve();
	await firstRun;
	await thirdRun;
	second.resolve();
	await secondRun;
	assert.deepEqual(events, [
		'first-start',
		'second-start',
		'first-end',
		'third-start',
		'second-end',
	]);
});

await test('rejects work when the queue is full', async () => {
	const limiter = createTaskLimiter(1, 1, 1000);
	const active = deferred();
	const activeRun = limiter.run(async () => active.promise);
	const queuedRun = limiter.run(async () => undefined);

	await assert.rejects(
		limiter.run(async () => undefined),
		(error: unknown) => {
			assert.ok(error instanceof TaskLimitError);
			assert.equal(error.code, 'queue-full');
			return true;
		},
	);

	active.resolve();
	await Promise.all([activeRun, queuedRun]);
});

await test('times out work that waits too long', async () => {
	const limiter = createTaskLimiter(1, 1, 10);
	const active = deferred();
	const activeRun = limiter.run(async () => active.promise);

	await assert.rejects(
		limiter.run(async () => undefined),
		(error: unknown) => {
			assert.ok(error instanceof TaskLimitError);
			assert.equal(error.code, 'queue-timeout');
			return true;
		},
	);

	active.resolve();
	await activeRun;
});
