import type { Context as HonoContext } from 'hono';

import type { JobDefinition, SimpleTriggerJobOptions } from './_internal/job';

export abstract class BaseJobProvider {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async triggerJob(_options: SimpleTriggerJobOptions): Promise<void> {
    throw new Error('Not implemented');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public defineJob<N extends string, T>(_job: JobDefinition<N, T>): void {
    throw new Error('Not implemented');
  }

  public getApiHandler(): (req: HonoContext) => Promise<Response | void> {
    throw new Error('Not implemented');
  }
}
