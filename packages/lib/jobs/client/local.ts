import type { NextApiRequest, NextApiResponse } from 'next';

import { json } from 'micro';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { sign } from '../../server-only/crypto/sign';
import { verify } from '../../server-only/crypto/verify';
import type { JobDefinition, JobRunIO, TriggerJobOptions } from './_internal/job';
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

  public defineJob<T>(definition: JobDefinition<T>) {
    this._jobDefinitions[definition.id] = {
      ...definition,
      enabled: definition.enabled ?? true,
    };
  }

  public async triggerJob(options: TriggerJobOptions) {
    const signature = sign(options);

    await Promise.race([
      fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/jobs/trigger`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
          'Content-Type': 'application/json',
          'X-Job-Signature': signature,
        },
      }),
      new Promise((resolve) => {
        setTimeout(resolve, 150);
      }),
    ]);
  }

  public getApiHandler() {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      if (req.method === 'POST') {
        const signature = req.headers['x-job-signature'];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const options = (await json(req)) as TriggerJobOptions;

        const definition = this._jobDefinitions[options.name];

        if (typeof signature !== 'string' || typeof options !== 'object') {
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

        await definition.handler({
          payload: options.payload,
          io: this.createJobRunIO(options.name),
        });

        res.status(200).send('OK');
      } else {
        res.status(405).send('Method not allowed');
      }
    };
  }

  private createJobRunIO(jobId: string): JobRunIO {
    return {
      stableRun: async (_cacheKey, callback) => await callback(),
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
