/* eslint-disable turbo/no-undeclared-env-vars */
import { Redis } from '@upstash/redis';

// !: We're null coalescing here because we don't want local builds to fail.
export const redis = new Redis({
  url: process.env.NEXT_PRIVATE_REDIS_URL ?? '',
  token: process.env.NEXT_PRIVATE_REDIS_TOKEN ?? '',
});
