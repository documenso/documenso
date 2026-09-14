import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { envelopeContentRateLimit, fileUploadRateLimit } from './rate-limits';

/**
 * In-memory stand-in for the `RateLimit` table: counters keyed by
 * key + action + bucket, incremented atomically like the real upsert.
 */
const { counters } = vi.hoisted(() => ({ counters: new Map<string, number>() }));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    rateLimit: {
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { key_action_bucket: { key: string; action: string; bucket: Date } };
        create: { count: number };
        update: { count: { increment: number } };
      }) => {
        const { key, action, bucket } = where.key_action_bucket;
        const counterKey = `${key}|${action}|${bucket.getTime()}`;

        const count = counters.has(counterKey)
          ? (counters.get(counterKey) ?? 0) + update.count.increment
          : create.count;

        counters.set(counterKey, count);

        return Promise.resolve({ count });
      },
    },
  },
}));

const IP = '203.0.113.7';

/**
 * Consume the whole budget of a limiter for the IP.
 */
const exhaust = async (limiter: typeof fileUploadRateLimit) => {
  const { limit } = await limiter.check({ ip: IP });

  for (let i = 1; i < limit; i += 1) {
    await limiter.check({ ip: IP });
  }

  const exceeded = await limiter.check({ ip: IP });

  expect(exceeded.isLimited).toBe(true);
};

describe('envelopeContentRateLimit', () => {
  const originalBypass = process.env.DANGEROUS_BYPASS_RATE_LIMITS;

  beforeEach(() => {
    counters.clear();
    process.env.DANGEROUS_BYPASS_RATE_LIMITS = 'false';
  });

  afterEach(() => {
    process.env.DANGEROUS_BYPASS_RATE_LIMITS = originalBypass;
  });

  it('is not consumed by file uploads', async () => {
    await exhaust(fileUploadRateLimit);

    const result = await envelopeContentRateLimit.check({ ip: IP });

    expect(result.isLimited).toBe(false);
    expect(result.remaining).toBe(result.limit - 1);
  });

  it('does not consume the file upload budget', async () => {
    await exhaust(envelopeContentRateLimit);

    const result = await fileUploadRateLimit.check({ ip: IP });

    expect(result.isLimited).toBe(false);
    expect(result.remaining).toBe(result.limit - 1);
  });
});
