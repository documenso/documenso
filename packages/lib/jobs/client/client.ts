import type { JobDefinition, TriggerJobOptions } from './_internal/job';
import type { BaseJobProvider as JobClientProvider } from './base';
import { LocalJobProvider } from './local';
import { TriggerJobProvider } from './trigger';

export class JobClient {
  private static _instance: JobClient;

  private _provider: JobClientProvider;

  private constructor() {
    if (process.env.NEXT_PRIVATE_JOBS_PROVIDER === 'trigger') {
      this._provider = TriggerJobProvider.getInstance();
    }

    this._provider = LocalJobProvider.getInstance();
  }

  public static getInstance() {
    if (!this._instance) {
      this._instance = new JobClient();
    }

    return this._instance;
  }

  public async triggerJob(options: TriggerJobOptions) {
    return this._provider.triggerJob(options);
  }

  public defineJob<T>(job: JobDefinition<T>) {
    return this._provider.defineJob(job);
  }

  public getApiHandler() {
    return this._provider.getApiHandler();
  }
}
