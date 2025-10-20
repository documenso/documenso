import { match } from 'ts-pattern';

import { env } from '../../utils/env';
import type { JobDefinition, TriggerJobOptions } from './_internal/job';
import type { BaseJobProvider as JobClientProvider } from './base';
import { InngestJobProvider } from './inngest';
import { LocalJobProvider } from './local';

export class JobClient<T extends ReadonlyArray<JobDefinition> = []> {
  private _provider: JobClientProvider;

  public constructor(definitions: T) {
    this._provider = match(env('NEXT_PRIVATE_JOBS_PROVIDER'))
      .with('inngest', () => InngestJobProvider.getInstance())
      .otherwise(() => {
        console.warn(
          '⚠️  Local job provider detected. Document reminders will not work as they require scheduled jobs. ' +
            'To enable reminders, configure Inngest by setting NEXT_PRIVATE_JOBS_PROVIDER=inngest and providing NEXT_PRIVATE_INNGEST_EVENT_KEY.',
        );
        return LocalJobProvider.getInstance();
      });

    definitions.forEach((definition) => {
      this._provider.defineJob(definition);
    });
  }

  public async triggerJob(options: TriggerJobOptions<T>) {
    return this._provider.triggerJob(options);
  }

  public getApiHandler() {
    return this._provider.getApiHandler();
  }
}
