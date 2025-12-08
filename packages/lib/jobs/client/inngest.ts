import type { Context as HonoContext } from 'hono';
import type { Context, Handler, InngestFunction } from 'inngest';
import { Inngest as InngestClient } from 'inngest';
import type { Logger } from 'inngest';
import { serve as createHonoPagesRoute } from 'inngest/hono';

import { env } from '../../utils/env';
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
        id: env('NEXT_PRIVATE_INNGEST_APP_ID') || 'documenso-app',
        eventKey: env('INNGEST_EVENT_KEY') || env('NEXT_PRIVATE_INNGEST_EVENT_KEY'),
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
        optimizeParallelism: job.optimizeParallelism ?? false,
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
    return async (context: HonoContext) => {
      const handler = createHonoPagesRoute({
        client: this._client,
        functions: this._functions,
      });

      return await handler(context);
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
