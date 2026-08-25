import { prisma } from '@documenso/prisma';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobsClient } from '../../jobs/client';
import { generateDatabaseId } from '../../universal/id';
import { currentMonthlyPeriod } from '../../universal/monthly-period';
import { getQuotaAlertKind } from './get-quota-alert-kind';
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

  const { alertKind } = await prisma.$transaction(async (tx) => {
    const latestMonthlyStat = await tx.organisationMonthlyStat.upsert({
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

    if (opts.quota === null) {
      return { alertKind: null };
    }

    const currentCount = latestMonthlyStat[column];
    const previousCount = currentCount - opts.count;

    const calculatedAlertKind = getQuotaAlertKind({
      previousCount,
      newCount: currentCount,
      quota: opts.quota,
    });

    if (currentCount > opts.quota) {
      throw new AppError(AppErrorCode.TOO_MANY_REQUESTS, {
        message:
          'Your request could not be completed at this time due to your account exceeding the fair use limits of your current plan. Please contact support.',
        // Not tossing headers here to avoid confusion, this isn't rate limits.
      });
    }

    return {
      alertKind: calculatedAlertKind,
    };
  });

  // For unlimited quotas, we still allow the request to send so we can collect the monthly stat.
  if (opts.quota === null) {
    return;
  }

  // Trigger the alert when nearing or reaching quota.
  if (alertKind) {
    await jobsClient
      .triggerJob({
        name: 'send.organisation-limit-alert.email',
        payload: {
          organisationId: opts.organisationId,
          counter: opts.counter,
          kind: alertKind,
          period,
        },
      })
      .catch((error) => {
        console.error({
          msg: 'Failed to send organisation limit alert email',
          error,
        });

        // Do nothing.
      });
  }
};
