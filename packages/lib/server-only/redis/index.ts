/* eslint-disable turbo/no-undeclared-env-vars */
import { Redis } from '@upstash/redis';

import { env } from '../../utils/env';

// !: We're null coalescing here because we don't want local builds to fail.
export const redis = new Redis({
  url: env('NEXT_PRIVATE_REDIS_URL') ?? '',
  token: env('NEXT_PRIVATE_REDIS_TOKEN') ?? '',
});
