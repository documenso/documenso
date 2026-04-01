import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { sha256 } from '@noble/hashes/sha2';
import { BackgroundJobStatus, Prisma } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import IORedis from 'ioredis';
import { createRequire } from 'node:module';
import path from 'node:path';

import { prisma } from '@documenso/prisma';

import { env } from '../../utils/env';
import type { JobDefinition, JobRunIO, SimpleTriggerJobOptions } from './_internal/job';
import type { Json } from './_internal/json';
import { BaseJobProvider } from './base';

const QUEUE_NAME = 'documenso-jobs';

const DEFAULT_CONCURRENCY = 10;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_DELAY = 1000;

declare global {
  // eslint-disable-next-line no-var
  var __documenso_bullmq_provider__: BullMQJobProvider | undefined;
}

export class BullMQJobProvider extends BaseJobProvider {
  private _queue: Queue;
  private _worker: Worker;
  private _connection: IORedis;
  private _jobDefinitions: Record<string, JobDefinition> = {};

  private constructor() {
    super();

    const redisUrl = env('NEXT_PRIVATE_REDIS_URL');

    if (!redisUrl) {
      throw new Error(
        '[JOBS]: NEXT_PRIVATE_REDIS_URL is required when using the BullMQ jobs provider',
      );
    }

    const prefix = env('NEXT_PRIVATE_REDIS_PREFIX') || 'documenso';

    this._connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this._queue = new Queue(QUEUE_NAME, {
      connection: this._connection,
      prefix,
    });

    const concurrency = Number(env('NEXT_PRIVATE_BULLMQ_CONCURRENCY')) || DEFAULT_CONCURRENCY;

    this._worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        await this.processJob(job);
      },
      {
        connection: this._connection,
        prefix,
        concurrency,
      },
    );

    this._worker.on('failed', (job, error) => {
      console.error(`[JOBS]: Job ${job?.name ?? 'unknown'} failed`, error);
    });

    this._worker.on('error', (error) => {
      console.error('[JOBS]: Worker error', error);
    });

    console.log(`[JOBS]: BullMQ provider initialized (concurrency: ${concurrency})`);
  }

  /**
   * Uses globalThis to store the singleton instance so that it's shared across
   * different bundles (e.g. Hono and Vite/React Router) at runtime.
   */
  static getInstance() {
    if (globalThis.__documenso_bullmq_provider__) {
      return globalThis.__documenso_bullmq_provider__;
    }

    const instance = new BullMQJobProvider();

    globalThis.__documenso_bullmq_provider__ = instance;

    return instance;
  }

  public defineJob<N extends string, T>(definition: JobDefinition<N, T>) {
    this._jobDefinitions[definition.id] = {
      ...definition,
      enabled: definition.enabled ?? true,
    };

    if (definition.trigger.cron && definition.enabled !== false) {
      void this._queue
        .upsertJobScheduler(
          definition.id,
          { pattern: definition.trigger.cron },
          {
            name: definition.id,
            data: {
              name: definition.trigger.name,
              payload: {},
            },
            opts: {
              attempts: DEFAULT_MAX_RETRIES,
              backoff: {
                type: 'exponential',
                delay: DEFAULT_BACKOFF_DELAY,
              },
            },
          },
        )
        .then(() => {
          console.log(`[JOBS]: Registered cron job ${definition.id} (${definition.trigger.cron})`);
        })
        .catch((error) => {
          console.error(`[JOBS]: Failed to register cron job ${definition.id}`, error);
        });
    }
  }

  public async triggerJob(options: SimpleTriggerJobOptions) {
    const eligibleJobs = Object.values(this._jobDefinitions).filter(
      (job) => job.trigger.name === options.name,
    );

    await Promise.all(
      eligibleJobs.map(async (job) => {
        const backgroundJob = await prisma.backgroundJob.create({
          data: {
            jobId: job.id,
            name: job.name,
            version: job.version,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            payload: options.payload as Prisma.InputJsonValue,
          },
        });

        await this._queue.add(
          job.id,
          {
            name: options.name,
            payload: options.payload,
            backgroundJobId: backgroundJob.id,
          },
          {
            jobId: options.id,
            attempts: DEFAULT_MAX_RETRIES,
            backoff: {
              type: 'exponential',
              delay: DEFAULT_BACKOFF_DELAY,
            },
          },
        );
      }),
    );
  }

  public override getApiHandler(): (c: HonoContext) => Promise<Response | void> {
    const boardApp = this.createBoardApp();

    return async (c: HonoContext) => {
      const reqPath = new URL(c.req.url).pathname;

      if (!reqPath.startsWith('/api/jobs/board')) {
        return c.text('OK', 200);
      }

      // Auth check — open in dev, admin-only in production.
      if (env('NODE_ENV') !== 'development') {
        const { getOptionalSession } = await import('@documenso/auth/server/lib/utils/get-session');
        const { isAdmin } = await import('../../utils/is-admin');

        const { user } = await getOptionalSession(c);

        if (!user || !isAdmin(user)) {
          return c.text('Unauthorized', 401);
        }
      }

      return boardApp.fetch(c.req.raw);
    };
  }

  private createBoardApp(): Hono {
    const _require = createRequire(import.meta.url);
    const uiPackagePath = path.dirname(_require.resolve('@bull-board/ui/package.json'));

    const serverAdapter = new HonoAdapter(serveStatic);

    createBullBoard({
      queues: [new BullMQAdapter(this._queue)],
      serverAdapter,
      options: { uiBasePath: uiPackagePath },
    });

    serverAdapter.setBasePath('/api/jobs/board');

    const app = new Hono();

    app.route('/api/jobs/board', serverAdapter.registerPlugin());

    return app;
  }

  private async processJob(job: Job) {
    const definitionId = job.name;
    const definition = this._jobDefinitions[definitionId];

    if (!definition) {
      console.error(`[JOBS]: No definition found for job ${definitionId}`);
      throw new Error(`No definition found for job ${definitionId}`);
    }

    if (!definition.enabled) {
      console.log(`[JOBS]: Skipping disabled job ${definitionId}`);
      return;
    }

    const jobData = job.data as {
      name: string;
      payload: unknown;
      backgroundJobId?: string;
    };

    if (definition.trigger.schema) {
      const result = definition.trigger.schema.safeParse(jobData.payload);

      if (!result.success) {
        console.error(`[JOBS]: Payload validation failed for ${definitionId}`, result.error);
        throw new Error(`Payload validation failed for ${definitionId}`);
      }
    }

    const backgroundJobId = jobData.backgroundJobId;

    if (backgroundJobId) {
      await prisma.backgroundJob
        .update({
          where: {
            id: backgroundJobId,
            status: BackgroundJobStatus.PENDING,
          },
          data: {
            status: BackgroundJobStatus.PROCESSING,
            retried: job.attemptsMade > 0 ? job.attemptsMade : 0,
            lastRetriedAt: job.attemptsMade > 0 ? new Date() : undefined,
          },
        })
        .catch(() => null);
    }

    console.log(`[JOBS]: Processing job ${definitionId} with payload`, jobData.payload);

    try {
      await definition.handler({
        payload: jobData.payload,
        io: this.createJobRunIO(backgroundJobId ?? job.id ?? definitionId),
      });

      if (backgroundJobId) {
        await prisma.backgroundJob
          .update({
            where: { id: backgroundJobId },
            data: {
              status: BackgroundJobStatus.COMPLETED,
              completedAt: new Date(),
            },
          })
          .catch(() => null);
      }
    } catch (error) {
      if (backgroundJobId) {
        const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? DEFAULT_MAX_RETRIES) - 1;

        await prisma.backgroundJob
          .update({
            where: { id: backgroundJobId },
            data: {
              status: isFinalAttempt ? BackgroundJobStatus.FAILED : BackgroundJobStatus.PENDING,
              completedAt: isFinalAttempt ? new Date() : undefined,
            },
          })
          .catch(() => null);
      }

      throw error;
    }
  }

  private createJobRunIO(jobId: string): JobRunIO {
    return {
      runTask: async <T extends void | Json>(cacheKey: string, callback: () => Promise<T>) => {
        const hashedKey = Buffer.from(sha256(cacheKey)).toString('hex');

        let task = await prisma.backgroundJobTask.findFirst({
          where: {
            id: `task-${hashedKey}--${jobId}`,
            jobId,
          },
        });

        if (!task) {
          task = await prisma.backgroundJobTask.create({
            data: {
              id: `task-${hashedKey}--${jobId}`,
              name: cacheKey,
              jobId,
              status: BackgroundJobStatus.PENDING,
            },
          });
        }

        if (task.status === BackgroundJobStatus.COMPLETED) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return task.result as T;
        }

        if (task.retried >= DEFAULT_MAX_RETRIES) {
          throw new Error('Task exceeded retries');
        }

        try {
          const result = await callback();

          await prisma.backgroundJobTask.update({
            where: {
              id: task.id,
              jobId,
            },
            data: {
              status: BackgroundJobStatus.COMPLETED,
              result: result === null ? Prisma.JsonNull : result,
              completedAt: new Date(),
            },
          });

          return result;
        } catch (err) {
          await prisma.backgroundJobTask.update({
            where: {
              id: task.id,
              jobId,
            },
            data: {
              status: BackgroundJobStatus.PENDING,
              retried: {
                increment: 1,
              },
            },
          });

          console.log(`[JOBS:${task.id}] Task failed`, err);

          throw err;
        }
      },
      triggerJob: async (_cacheKey, payload) => await this.triggerJob(payload),
      logger: {
        debug: (...args) => console.debug(`[${jobId}]`, ...args),
        error: (...args) => console.error(`[${jobId}]`, ...args),
        info: (...args) => console.info(`[${jobId}]`, ...args),
        log: (...args) => console.log(`[${jobId}]`, ...args),
        warn: (...args) => console.warn(`[${jobId}]`, ...args),
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      wait: async () => {
        throw new Error('Not implemented');
      },
    };
  }
}
