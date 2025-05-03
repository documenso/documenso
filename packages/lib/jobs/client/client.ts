import { match } from 'ts-pattern';

import { env } from '../../utils/env';
import type {
  JobDefinition,
  JobRunIO,
  SimpleTriggerJobOptions,
  TriggerJobOptions,
} from './_internal/job';
import type { BaseJobProvider as JobClientProvider } from './base';
import { InngestJobProvider } from './inngest';
import { LocalJobProvider } from './local';

export class JobClient<T extends ReadonlyArray<JobDefinition> = []> {
  private _provider: JobClientProvider;
  private _jobDefinitions: Record<string, JobDefinition> = {};

  public constructor(definitions: T) {
    this._provider = match(env('NEXT_PRIVATE_JOBS_PROVIDER'))
      .with('inngest', () => InngestJobProvider.getInstance())
      .otherwise(() => LocalJobProvider.getInstance());

    definitions.forEach((definition) => {
      this._provider.defineJob(definition);
      this._jobDefinitions[definition.id] = definition;
    });
  }

  /**
   * Check if Inngest background job processing is available.
   *
   * For Inngest to be considered available:
   * 1. NEXT_PRIVATE_JOBS_PROVIDER must be set to 'inngest'
   * 2. Either INNGEST_EVENT_KEY or NEXT_PRIVATE_INNGEST_EVENT_KEY must be provided
   *
   * If Inngest is not available, jobs will be executed synchronously without background scheduling.
   */
  public isInngestAvailable(): boolean {
    return (
      env('NEXT_PRIVATE_JOBS_PROVIDER') === 'inngest' &&
      Boolean(env('INNGEST_EVENT_KEY') || env('NEXT_PRIVATE_INNGEST_EVENT_KEY'))
    );
  }

  public async triggerJob(options: TriggerJobOptions<T>): Promise<unknown> {
    // When Inngest is not available, execute the job directly
    if (!this.isInngestAvailable()) {
      const eligibleJob = Object.values(this._jobDefinitions).find(
        (job) => job.trigger.name === options.name,
      );

      if (eligibleJob && eligibleJob.handler) {
        // Execute the job directly without scheduling
        const payload = options.payload;
        const io: JobRunIO = {
          wait: async (_cacheKey: string, ms: number): Promise<void> => {
            // Create a Promise that resolves after ms milliseconds
            return new Promise<void>((resolve) => {
              setTimeout(resolve, ms);
            });
          },
          logger: console,
          runTask: async <R>(cacheKey: string, callback: () => Promise<R>): Promise<R> => {
            return await callback();
          },
          triggerJob: async (
            _cacheKey: string,
            jobOptions: SimpleTriggerJobOptions,
          ): Promise<unknown> => {
            // Type casting is necessary due to generic constraints
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await this.triggerJob(jobOptions as any);
          },
        };

        try {
          return await eligibleJob.handler({ payload, io });
        } catch (error) {
          console.error(`Direct job execution failed for ${options.name}:`, error);
          throw error;
        }
      }
    }

    // Use background processing with Inngest if available
    return this._provider.triggerJob(options);
  }

  public getApiHandler() {
    return this._provider.getApiHandler();
  }
}
