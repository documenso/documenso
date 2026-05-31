import { prisma } from '@documenso/prisma';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobsClient } from '../../jobs/client';
import { generateDatabaseId } from '../../universal/id';
import { currentMonthlyPeriod } from './current-monthly-period';
import type { LimitCounter } from './types';

type CheckMonthlyQuotaOptions = {
  organisationId: string;
  counter: LimitCounter;
  quota: number | null;
  count: number;
};

const COUNTER_COLUMN = {
  document: 'documentCount',
  email: 'emailCount',
  api: 'apiCount',
} as const satisfies Record<LimitCounter, string>;

export const checkMonthlyQuota = async (opts: CheckMonthlyQuotaOptions): Promise<void> => {
  if (opts.quota === 0) {
    throw new AppError(AppErrorCode.TOO_MANY_REQUESTS, {
      message:
        'Your request could not be completed at this time due to your account exceeding the fair use limits of your current plan. Please contact support.',
      // Not tossing headers here to avoid confusion, this isn't rate limits.
    });
  }

  const period = currentMonthlyPeriod();
  const column = COUNTER_COLUMN[opts.counter];

  const latestMonthlyStat = await prisma.organisationMonthlyStat.upsert({
    where: {
      organisationId_period: {
        organisationId: opts.organisationId,
        period,
      },
    },
    update: {
      [column]: { increment: opts.count },
    },
    create: {
      id: generateDatabaseId('org_monthly_stat'),
      organisationId: opts.organisationId,
      period,
      [column]: opts.count,
    },
  });

  // For unlimited quotas, we still allow the request to send so we can collect the monthly stat.
  if (opts.quota === null) {
    return;
  }

  const newCount = latestMonthlyStat[column];
  const previousCount = newCount - opts.count;

  const isOverQuota = newCount > opts.quota;

  // Only notify on the single request that crossed the threshold: the count was
  // at/under quota before this request and over it after. Because the DB
  // serializes the atomic increment, the post-increment values are distinct and
  // monotonic, so exactly one request's (previousCount, newCount] interval
  // contains the quota boundary — guaranteeing the notification fires once.
  const didCrossQuota = isOverQuota && previousCount <= opts.quota;

  if (didCrossQuota) {
    await jobsClient
      .triggerJob({
        name: 'send.organisation-limit-exceeded.email',
        payload: {
          organisationId: opts.organisationId,
          counter: opts.counter,
          kind: 'quota',
          period,
        },
      })
      .catch((error) => {
        console.error({
          msg: 'Failed to send organisation limit exceeded email',
          error,
        });

        // Do nothing.
      });
  }

  if (isOverQuota) {
    throw new AppError(AppErrorCode.TOO_MANY_REQUESTS, {
      message:
        'Your request could not be completed at this time due to your account exceeding the fair use limits of your current plan. Please contact support.',
      // Not tossing headers here to avoid confusion, this isn't rate limits.
    });
  }
};
