import type { NextApiRequest, NextApiResponse } from 'next';

import { sha256 } from '@noble/hashes/sha256';
import { json } from 'micro';

import { prisma } from '@documenso/prisma';
import { BackgroundJobStatus, Prisma } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { sign } from '../../server-only/crypto/sign';
import { verify } from '../../server-only/crypto/verify';
import {
  type JobDefinition,
  type JobRunIO,
  type SimpleTriggerJobOptions,
  ZSimpleTriggerJobOptionsSchema,
} from './_internal/job';
import type { Json } from './_internal/json';
import { BaseJobProvider } from './base';

export class LocalJobProvider extends BaseJobProvider {
  private static _instance: LocalJobProvider;

  private _jobDefinitions: Record<string, JobDefinition> = {};

  private constructor() {
    super();
  }

  static getInstance() {
    if (!this._instance) {
      this._instance = new LocalJobProvider();
    }

    return this._instance;
  }

  public defineJob<N extends string, T>(definition: JobDefinition<N, T>) {
    this._jobDefinitions[definition.id] = {
      ...definition,
      enabled: definition.enabled ?? true,
    };
  }

  public async triggerJob(options: SimpleTriggerJobOptions) {
    console.log({ jobDefinitions: this._jobDefinitions });

    const eligibleJobs = Object.values(this._jobDefinitions).filter(
      (job) => job.trigger.name === options.name,
    );

    console.log({ options });
    console.log(
      'Eligible jobs:',
      eligibleJobs.map((job) => job.name),
    );

    await Promise.all(
      eligibleJobs.map(async (job) => {
        // Ideally we will change this to a createMany with returning later once we upgrade Prisma
        // @see: https://github.com/prisma/prisma/releases/tag/5.14.0
        const pendingJob = await prisma.backgroundJob.create({
          data: {
            jobId: job.id,
            name: job.name,
            version: job.version,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            payload: options.payload as Prisma.InputJsonValue,
          },
        });

        await this.submitJobToEndpoint({
          jobId: pendingJob.id,
          jobDefinitionId: pendingJob.jobId,
          data: options,
        });
      }),
    );
  }

  public getApiHandler() {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
      }

      const jobId = req.headers['x-job-id'];
      const signature = req.headers['x-job-signature'];
      const isRetry = req.headers['x-job-retry'] !== undefined;

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const options = await json(req)
        .then(async (data) => ZSimpleTriggerJobOptionsSchema.parseAsync(data))
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .then((data) => data as SimpleTriggerJobOptions)
        .catch(() => null);

      if (!options) {
        res.status(400).send('Bad request');
        return;
      }

      const definition = this._jobDefinitions[options.name];

      if (
        typeof jobId !== 'string' ||
        typeof signature !== 'string' ||
        typeof options !== 'object'
      ) {
        res.status(400).send('Bad request');
        return;
      }

      if (!definition) {
        res.status(404).send('Job not found');
        return;
      }

      if (definition && !definition.enabled) {
        console.log('Attempted to trigger a disabled job', options.name);

        res.status(404).send('Job not found');
        return;
      }

      if (!signature || !verify(options, signature)) {
        res.status(401).send('Unauthorized');
        return;
      }

      if (definition.trigger.schema) {
        const result = definition.trigger.schema.safeParse(options.payload);

        if (!result.success) {
          res.status(400).send('Bad request');
          return;
        }
      }

      console.log(`[JOBS]: Triggering job ${options.name} with payload`, options.payload);

      let backgroundJob = await prisma.backgroundJob
        .update({
          where: {
            id: jobId,
            status: BackgroundJobStatus.PENDING,
          },
          data: {
            status: BackgroundJobStatus.PROCESSING,
            retried: {
              increment: isRetry ? 1 : 0,
            },
            lastRetriedAt: isRetry ? new Date() : undefined,
          },
        })
        .catch(() => null);

      if (!backgroundJob) {
        res.status(404).send('Job not found');
        return;
      }

      try {
        await definition.handler({
          payload: options.payload,
          io: this.createJobRunIO(jobId),
        });

        backgroundJob = await prisma.backgroundJob.update({
          where: {
            id: jobId,
            status: BackgroundJobStatus.PROCESSING,
          },
          data: {
            status: BackgroundJobStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`[JOBS]: Job ${options.name} failed`, error);

        const taskHasExceededRetries = error instanceof BackgroundTaskExceededRetriesError;
        const jobHasExceededRetries =
          backgroundJob.retried >= backgroundJob.maxRetries &&
          !(error instanceof BackgroundTaskFailedError);

        if (taskHasExceededRetries || jobHasExceededRetries) {
          backgroundJob = await prisma.backgroundJob.update({
            where: {
              id: jobId,
              status: BackgroundJobStatus.PROCESSING,
            },
            data: {
              status: BackgroundJobStatus.FAILED,
              completedAt: new Date(),
            },
          });

          res.status(500).send('Task exceeded retries');
          return;
        }

        backgroundJob = await prisma.backgroundJob.update({
          where: {
            id: jobId,
            status: BackgroundJobStatus.PROCESSING,
          },
          data: {
            status: BackgroundJobStatus.PENDING,
          },
        });

        await this.submitJobToEndpoint({
          jobId,
          jobDefinitionId: backgroundJob.jobId,
          data: options,
        });
      }

      res.status(200).send('OK');
    };
  }

  private async submitJobToEndpoint(options: {
    jobId: string;
    jobDefinitionId: string;
    data: SimpleTriggerJobOptions;
    isRetry?: boolean;
  }) {
    const { jobId, jobDefinitionId, data, isRetry } = options;

    const endpoint = `${NEXT_PUBLIC_WEBAPP_URL()}/api/jobs/${jobDefinitionId}/${jobId}`;
    const signature = sign(data);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Job-Id': jobId,
      'X-Job-Signature': signature,
    };

    if (isRetry) {
      headers['X-Job-Retry'] = '1';
    }

    console.log('Submitting job to endpoint:', endpoint);
    await Promise.race([
      fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        headers,
      }).catch(() => null),
      new Promise((resolve) => {
        setTimeout(resolve, 150);
      }),
    ]);
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

        if (task.retried >= 3) {
          throw new BackgroundTaskExceededRetriesError('Task exceeded retries');
        }

        try {
          const result = await callback();

          task = await prisma.backgroundJobTask.update({
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
        } catch {
          task = await prisma.backgroundJobTask.update({
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

          throw new BackgroundTaskFailedError('Task failed');
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

class BackgroundTaskFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackgroundTaskFailedError';
  }
}

class BackgroundTaskExceededRetriesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackgroundTaskExceededRetriesError';
  }
}
