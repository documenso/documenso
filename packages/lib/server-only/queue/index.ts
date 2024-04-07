import type { WorkHandler } from 'pg-boss';
import PgBoss from 'pg-boss';

import { jobHandlers } from './job';

type QueueState = {
  isReady: boolean;
  queue: PgBoss | null;
};

let initPromise: Promise<PgBoss> | null = null;
const state: QueueState = {
  isReady: false,
  queue: null,
};

export async function initQueue() {
  if (state.isReady) {
    return state.queue as PgBoss;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const queue = new PgBoss({
      connectionString: 'postgres://postgres:password@127.0.0.1:54321/queue',

      schema: 'documenso_queue',
    });

    try {
      await queue.start();
    } catch (error) {
      console.error('Failed to start queue', error);
    }

    await Promise.all(
      Object.entries(jobHandlers).map(async ([job, jobHandler]) => {
        await queue.work(job, jobHandler as WorkHandler<unknown>);
      }),
    );

    state.isReady = true;
    state.queue = queue;

    return queue;
  })();

  return initPromise;
}
