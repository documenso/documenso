import { z } from 'zod';

import type { Json } from './json';

export type SimpleTriggerJobOptions = {
  id?: string;
  name: string;
  payload: unknown;
  timestamp?: number;
};

export const ZSimpleTriggerJobOptionsSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  payload: z.unknown().refine((x) => x !== undefined, { message: 'payload is required' }),
  timestamp: z.number().optional(),
});

// Map the array to create a union of objects we may accept
export type TriggerJobOptions<Definitions extends ReadonlyArray<JobDefinition> = []> = {
  [K in keyof Definitions]: {
    id?: string;
    name: Definitions[K]['trigger']['name'];
    payload: Definitions[K]['trigger']['schema'] extends z.ZodType<infer Shape> ? Shape : unknown;
    timestamp?: number;
  };
}[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobDefinition<Name extends string = string, Schema = any> = {
  id: string;
  name: string;
  version: string;
  enabled?: boolean;
  optimizeParallelism?: boolean;
  trigger: {
    name: Name;
    schema?: z.ZodType<Schema>;
  };
  handler: (options: { payload: Schema; io: JobRunIO }) => Promise<Json | void>;
};

export interface JobRunIO {
  // stableRun<T extends Json | void>(cacheKey: string, callback: (io: JobRunIO) => T | Promise<T>): Promise<T>;
  runTask<T extends Json | void | undefined>(
    cacheKey: string,
    callback: () => Promise<T>,
  ): Promise<T>;
  triggerJob(cacheKey: string, options: SimpleTriggerJobOptions): Promise<unknown>;
  wait(cacheKey: string, ms: number): Promise<void>;
  logger: {
    info(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    log(...args: unknown[]): void;
  };
}

export const defineJob = <N extends string, T = unknown>(
  job: JobDefinition<N, T>,
): JobDefinition<N, T> => job;
