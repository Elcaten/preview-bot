type TaskLimitErrorCode = 'queue-full' | 'queue-timeout';

export class TaskLimitError extends Error {
	readonly code: TaskLimitErrorCode;

	constructor(code: TaskLimitErrorCode) {
		super(code === 'queue-full'
			? 'The task queue is full'
			: 'Timed out while waiting in the task queue');
		this.name = 'TaskLimitError';
		this.code = code;
	}
}

export type TaskLimiter = {
	run<Result>(task: () => Promise<Result>): Promise<Result>;
};

type WaitingTask = {
	reject: (error: TaskLimitError) => void;
	resolve: () => void;
	timer: ReturnType<typeof setTimeout>;
};

export function createTaskLimiter(
	maximumConcurrent: number,
	maximumQueued: number,
	waitTimeoutMilliseconds: number,
): TaskLimiter {
	let activeTasks = 0;
	const waitingTasks: WaitingTask[] = [];

	async function acquire(): Promise<void> {
		if (activeTasks < maximumConcurrent) {
			activeTasks++;
			return;
		}

		if (waitingTasks.length >= maximumQueued) {
			throw new TaskLimitError('queue-full');
		}

		await new Promise<void>((resolve, reject) => {
			const waitingTask: WaitingTask = {
				reject,
				resolve,
				timer: setTimeout(() => {
					const index = waitingTasks.indexOf(waitingTask);
					if (index !== -1) {
						waitingTasks.splice(index, 1);
					}

					reject(new TaskLimitError('queue-timeout'));
				}, waitTimeoutMilliseconds),
			};
			waitingTasks.push(waitingTask);
		});
	}

	function release(): void {
		const waitingTask = waitingTasks.shift();
		if (waitingTask) {
			clearTimeout(waitingTask.timer);
			waitingTask.resolve();
			return;
		}

		activeTasks--;
	}

	return {
		async run<Result>(task: () => Promise<Result>): Promise<Result> {
			await acquire();
			try {
				return await task();
			} finally {
				release();
			}
		},
	};
}
