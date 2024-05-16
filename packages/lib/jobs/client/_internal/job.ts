import { z } from 'zod';

import type { Json } from './json';

export const ZTriggerJobOptionsSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  payload: z.any().refine((x) => x !== undefined, { message: 'payload is required' }),
  timestamp: z.number().optional(),
});

// The Omit is a temporary workaround for a "bug" in the zod library
// @see: https://github.com/colinhacks/zod/issues/2966
export type TriggerJobOptions = Omit<z.infer<typeof ZTriggerJobOptionsSchema>, 'payload'> & {
  // Don't tell the feds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobDefinition<T = any> = {
  id: string;
  name: string;
  version: string;
  enabled?: boolean;
  trigger: {
    name: string;
    schema?: z.ZodSchema<T>;
  };
  handler: (options: { payload: T; io: JobRunIO }) => Promise<Json | void>;
};

export interface JobRunIO {
  // stableRun<T extends Json | void>(cacheKey: string, callback: (io: JobRunIO) => T | Promise<T>): Promise<T>;
  runTask<T extends Json | void>(cacheKey: string, callback: () => Promise<T>): Promise<T>;
  triggerJob(cacheKey: string, options: TriggerJobOptions): Promise<unknown>;
  wait(cacheKey: string, ms: number): Promise<void>;
  logger: {
    info(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    log(...args: unknown[]): void;
  };
}
