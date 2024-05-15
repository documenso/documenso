import type { NextApiRequest, NextApiResponse } from 'next';

import type { JobDefinition, TriggerJobOptions } from './_internal/job';

export abstract class BaseJobProvider {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async triggerJob(_options: TriggerJobOptions): Promise<void> {
    throw new Error('Not implemented');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public defineJob<T>(_job: JobDefinition<T>): void {
    throw new Error('Not implemented');
  }

  public getApiHandler(): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
    throw new Error('Not implemented');
  }
}
