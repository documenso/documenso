import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { generateDatabaseId } from '../../universal/id';
import { currentMonthlyPeriod } from '../../universal/monthly-period';
import { logger } from '../../utils/logger';
import { reportSenderRateLimit } from '../rate-limit/rate-limits';

type ReportRecipientOptions = {
  token: string;
  ipAddress?: string;
};

export const reportRecipient = async ({ token, ipAddress }: ReportRecipientOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: { token },
    select: {
      id: true,
      envelopeId: true,
      envelope: {
        select: {
          team: {
            select: {
              id: true,
              organisationId: true,
            },
          },
        },
      },
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient could not be found',
    });
  }

  // The recipient has explicitly submitted the report, so this is a deliberate human
  // action rather than an email scanner following a link. The rate limit de-duplicates
  // repeat submissions per envelope+recipient within a fixed ~7-day bucket, so
  // `emailReports` is an approximate metric rather than a strict once-per-recipient guarantee.
  const rateLimitResult = await reportSenderRateLimit.check({
    ip: ipAddress ?? 'unknown',
    identifier: `${recipient.envelopeId}:${recipient.id}`,
  });

  if (rateLimitResult.isLimited) {
    return;
  }

  const period = currentMonthlyPeriod();
  const { organisationId } = recipient.envelope.team;

  // Incrementing the stat is a non-critical side effect; fail soft so a transient
  // DB error never turns reporting into a user-facing error.
  await prisma.organisationMonthlyStat
    .upsert({
      where: {
        organisationId_period: {
          organisationId,
          period,
        },
      },
      update: {
        emailReports: { increment: 1 },
      },
      create: {
        id: generateDatabaseId('org_monthly_stat'),
        organisationId,
        period,
        emailReports: 1,
      },
    })
    .catch((error) => {
      logger.error({
        msg: 'Failed to increment organisation emailReports stat',
        error,
      });
    });
};
