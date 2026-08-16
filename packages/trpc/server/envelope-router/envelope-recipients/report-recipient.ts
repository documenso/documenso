import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { reportSenderRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { prisma } from '@documenso/prisma';
import { procedure } from '../../trpc';
import { ZReportRecipientRequestSchema, ZReportRecipientResponseSchema } from './report-recipient.types';

/**
 * NOTE: THIS IS A PUBLIC (UNAUTHENTICATED) PROCEDURE.
 * Recipients report a sender directly from a link in their email, so no session or
 * API token is required.
 */
export const reportRecipientRoute = procedure
  .input(ZReportRecipientRequestSchema)
  .output(ZReportRecipientResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { token } = input;

    if (!token) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Token is required',
      });
    }

    const { ipAddress } = ctx.metadata.requestMetadata;

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

    // Rate limit to ensure we aren't double reporting by accident.
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
        ctx.logger.error({
          msg: 'Failed to increment organisation emailReports stat',
          error,
        });
      });

    ctx.logger.info({
      msg: `Email reported. Recipient: ${recipient.id}. Envelope: ${recipient.envelopeId}.`,
    });
  });
