import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest } from 'next/server';

import type { Context, Handler, InngestFunction } from 'inngest';
import { Inngest as InngestClient } from 'inngest';
import type { Logger } from 'inngest/middleware/logger';
import { serve as createPagesRoute } from 'inngest/next';
import { json } from 'micro';

import type { JobDefinition, JobRunIO, SimpleTriggerJobOptions } from './_internal/job';
import { BaseJobProvider } from './base';

export class InngestJobProvider extends BaseJobProvider {
  private static _instance: InngestJobProvider;

  private _client: InngestClient;
  private _functions: Array<InngestFunction<InngestFunction.Options, Handler.Any, Handler.Any>> =
    [];

  private constructor(options: { client: InngestClient }) {
    super();

    this._client = options.client;
  }

  static getInstance() {
    if (!this._instance) {
      const client = new InngestClient({
        id: 'documenso-app',
        eventKey: process.env.NEXT_PRIVATE_INNGEST_EVENT_KEY,
      });

      this._instance = new InngestJobProvider({ client });
    }

    return this._instance;
  }

  public defineJob<N extends string, T>(job: JobDefinition<N, T>): void {
    console.log('defining job', job.id);
    const fn = this._client.createFunction(
      {
        id: job.id,
        name: job.name,
      },
      {
        event: job.trigger.name,
      },
      async (ctx) => {
        const io = this.convertInngestIoToJobRunIo(ctx);

        // We need to cast to any so we can deal with parsing later.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        let payload = ctx.event.data as any;

        if (job.trigger.schema) {
          payload = job.trigger.schema.parse(payload);
        }

        await job.handler({ payload, io });
      },
    );

    this._functions.push(fn);
  }

  public async triggerJob(options: SimpleTriggerJobOptions): Promise<void> {
    await this._client.send({
      id: options.id,
      name: options.name,
      data: options.payload,
      ts: options.timestamp,
    });
  }

  public getApiHandler() {
    const handler = createPagesRoute({
      client: this._client,
      functions: this._functions,
    });

    return async (req: NextApiRequest, res: NextApiResponse) => {
      // Since body-parser is disabled for this route we need to patch in the parsed body
      if (req.headers['content-type'] === 'application/json') {
        Object.assign(req, {
          body: await json(req),
        });
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const nextReq = req as unknown as NextRequest;

      return await handler(nextReq, res);
    };
  }

  private convertInngestIoToJobRunIo(ctx: Context.Any & { logger: Logger }) {
    const { step } = ctx;

    return {
      wait: step.sleep,
      logger: {
        ...ctx.logger,
        log: ctx.logger.info,
      },
      runTask: async (cacheKey, callback) => {
        const result = await step.run(cacheKey, callback);

        // !: Not dealing with this right now but it should be correct.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        return result as any;
      },
      triggerJob: async (cacheKey, payload) =>
        step.sendEvent(cacheKey, {
          ...payload,
          timestamp: payload.timestamp,
        }),
    } satisfies JobRunIO;
  }
}
