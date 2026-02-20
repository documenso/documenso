import { prisma } from '@documenso/prisma';

import { logger } from '../../utils/logger';

type WindowUnit = 's' | 'm' | 'h' | 'd';
type WindowStr = `${number}${WindowUnit}`;

type RateLimitConfig = {
  action: string;
  max: number;
  globalMax?: number;
  window: WindowStr;
};

type CheckParams = {
  ip: string;
  identifier?: string;
};

export type RateLimitCheckResult = {
  isLimited: boolean;
  remaining: number;
  limit: number;
  reset: Date;
};

/**
 * Parse window string (e.g., '1h', '15m', '30s') to milliseconds.
 */
export const parseWindow = (window: WindowStr): number => {
  const value = parseInt(window.slice(0, -1), 10);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const unit = window.slice(-1) as WindowUnit;

  const multipliers: Record<WindowUnit, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};

/**
 * Compute the current time bucket for the given window size.
 */
export const getBucket = (windowMs: number): Date => {
  const now = Date.now();

  return new Date(now - (now % windowMs));
};

/**
 * Create a rate limiter with the given configuration.
 *
 * Uses bucketed counters in the database for distributed rate limiting
 * across multiple instances. Each check atomically increments the counter
 * and returns the new count.
 */
export const createRateLimit = (config: RateLimitConfig) => {
  const windowMs = parseWindow(config.window);

  return {
    async check(params: CheckParams): Promise<RateLimitCheckResult> {
      const bucket = getBucket(windowMs);
      const reset = new Date(bucket.getTime() + windowMs);
      const ipLimit = config.globalMax ?? config.max;

      if (process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true') {
        return {
          isLimited: false,
          remaining: ipLimit,
          limit: ipLimit,
          reset,
        };
      }

      try {
        // Always upsert the IP counter.
        const ipResult = await prisma.rateLimit.upsert({
          where: {
            key_action_bucket: {
              key: `ip:${params.ip}`,
              action: config.action,
              bucket,
            },
          },
          create: {
            key: `ip:${params.ip}`,
            action: config.action,
            bucket,
            count: 1,
          },
          update: {
            count: { increment: 1 },
          },
        });

        // Check IP against globalMax if set, or against max if no identifier is provided.
        let ipCheckLimit = config.globalMax;

        if (!params.identifier) {
          ipCheckLimit = config.max;
        }

        if (ipCheckLimit && ipResult.count >= ipCheckLimit) {
          logger.warn({
            msg: 'Rate limit exceeded',
            action: config.action,
            keyType: 'ip',
            key: params.ip,
            count: ipResult.count,
            limit: ipCheckLimit,
          });

          return {
            isLimited: true,
            remaining: 0,
            limit: ipCheckLimit,
            reset,
          };
        }

        // Upsert the identifier counter if provided.
        if (params.identifier) {
          const identifierResult = await prisma.rateLimit.upsert({
            where: {
              key_action_bucket: {
                key: `id:${params.identifier}`,
                action: config.action,
                bucket,
              },
            },
            create: {
              key: `id:${params.identifier}`,
              action: config.action,
              bucket,
              count: 1,
            },
            update: {
              count: { increment: 1 },
            },
          });

          if (identifierResult.count >= config.max) {
            logger.warn({
              msg: 'Rate limit exceeded',
              action: config.action,
              keyType: 'identifier',
              key: params.identifier,
              count: identifierResult.count,
              limit: config.max,
            });

            return {
              isLimited: true,
              remaining: 0,
              limit: config.max,
              reset,
            };
          }

          return {
            isLimited: false,
            remaining: Math.max(0, config.max - identifierResult.count),
            limit: config.max,
            reset,
          };
        }

        return {
          isLimited: false,
          remaining: Math.max(0, ipLimit - ipResult.count),
          limit: ipLimit,
          reset,
        };
      } catch (error) {
        // Fail-open: if the rate limit DB query fails, allow the request through.
        logger.error({
          msg: 'Rate limit check failed, failing open',
          action: config.action,
          error,
        });

        const limit = params.identifier ? config.max : ipLimit;

        return {
          isLimited: false,
          remaining: limit,
          limit,
          reset,
        };
      }
    },
  };
};
