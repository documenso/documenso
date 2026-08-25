import { prisma } from '@documenso/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { currentMonthlyPeriod } from '../../universal/monthly-period';
import { checkMonthlyQuota } from './check-monthly-quota';

describe('checkMonthlyQuota - concurrent race condition tests', () => {
  const organisationId = 'org_test_concurrency_123';
  const period = currentMonthlyPeriod();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly handles 10 concurrent requests with quota = 5 and rejects overflow requests atomically', async () => {
    let internalDocumentCount = 0;

    // Mock prisma.$transaction to simulate serializable / atomic transaction behavior
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const tx = {
        organisationMonthlyStat: {
          upsert: (args: Prisma.OrganisationMonthlyStatUpsertArgs) => {
            const increment =
              typeof args.update?.documentCount === 'object' &&
              args.update?.documentCount !== null &&
              'increment' in args.update.documentCount
                ? Number(args.update.documentCount.increment)
                : 1;
            internalDocumentCount += increment;
            return Promise.resolve({
              id: 'stat_1',
              organisationId,
              period,
              documentCount: internalDocumentCount,
              emailCount: 0,
              apiCount: 0,
              emailReports: 0,
            });
          },
        },
      } as unknown as PrismaClient;

      return await callback(tx);
    });

    const QUOTA = 5;
    const TOTAL_REQUESTS = 10;

    const results = await Promise.allSettled(
      Array.from({ length: TOTAL_REQUESTS }).map(() =>
        checkMonthlyQuota({
          organisationId,
          counter: 'document',
          quota: QUOTA,
          count: 1,
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly QUOTA requests succeed
    expect(fulfilled.length).toBe(QUOTA);

    // Exactly (TOTAL_REQUESTS - QUOTA) requests fail with TOO_MANY_REQUESTS
    expect(rejected.length).toBe(TOTAL_REQUESTS - QUOTA);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(AppError);
        expect((rej.reason as AppError).code).toBe(AppErrorCode.TOO_MANY_REQUESTS);
      }
    }
  });

  it('rejects all concurrent requests if quota is 0', async () => {
    const TOTAL_REQUESTS = 5;

    const results = await Promise.allSettled(
      Array.from({ length: TOTAL_REQUESTS }).map(() =>
        checkMonthlyQuota({
          organisationId,
          counter: 'document',
          quota: 0,
          count: 1,
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(0);
    expect(rejected.length).toBe(TOTAL_REQUESTS);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(AppError);
        expect((rej.reason as AppError).code).toBe(AppErrorCode.TOO_MANY_REQUESTS);
      }
    }
  });

  it('allows all concurrent requests if quota is null (unlimited)', async () => {
    let internalDocumentCount = 0;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const tx = {
        organisationMonthlyStat: {
          upsert: (args: Prisma.OrganisationMonthlyStatUpsertArgs) => {
            const increment =
              typeof args.update?.documentCount === 'object' &&
              args.update?.documentCount !== null &&
              'increment' in args.update.documentCount
                ? Number(args.update.documentCount.increment)
                : 1;
            internalDocumentCount += increment;
            return Promise.resolve({
              id: 'stat_1',
              organisationId,
              period,
              documentCount: internalDocumentCount,
              emailCount: 0,
              apiCount: 0,
              emailReports: 0,
            });
          },
        },
      } as unknown as PrismaClient;

      return await callback(tx);
    });

    const TOTAL_REQUESTS = 10;

    const results = await Promise.allSettled(
      Array.from({ length: TOTAL_REQUESTS }).map(() =>
        checkMonthlyQuota({
          organisationId,
          counter: 'document',
          quota: null,
          count: 1,
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(TOTAL_REQUESTS);
    expect(internalDocumentCount).toBe(TOTAL_REQUESTS);
  });
});
