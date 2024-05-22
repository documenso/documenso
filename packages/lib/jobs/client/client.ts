import type { JobDefinition, TriggerJobOptions } from './_internal/job';
import type { BaseJobProvider as JobClientProvider } from './base';
import { LocalJobProvider } from './local';
import { TriggerJobProvider } from './trigger';

export class JobClient<T extends Array<JobDefinition> = []> {
  private static _instance: JobClient;

  private _provider: JobClientProvider;

  public constructor(definitions: T) {
    if (process.env.NEXT_PRIVATE_JOBS_PROVIDER === 'trigger') {
      this._provider = TriggerJobProvider.getInstance();

      return;
    }

    this._provider = LocalJobProvider.getInstance();

    definitions.forEach((definition) => {
      this._provider.defineJob(definition);
    });
  }

  // public static getInstance() {
  //   if (!this._instance) {
  //     this._instance = new JobClient();
  //   }

  //   return this._instance;
  // }

  public async triggerJob(options: TriggerJobOptions<T>) {
    return this._provider.triggerJob(options);
  }

  // public defineJob<N extends string, T>(job: JobDefinition<N, T>) {
  //   return this._provider.defineJob(job);
  // }

  public getApiHandler() {
    return this._provider.getApiHandler();
  }
}
