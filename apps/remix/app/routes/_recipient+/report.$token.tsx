import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { reportSenderRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { logger } from '@documenso/lib/utils/logger';
import { prisma } from '@documenso/prisma';
import { Trans } from '@lingui/react/macro';

import type { Route } from './+types/report.$token';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { token } = params;

  if (!token) {
    throw new Response('Not Found', { status: 404 });
  }

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
    throw new Response('Not Found', { status: 404 });
  }

  const { ipAddress } = extractRequestMetadata(request);

  // Reporting happens on GET (the recipient clicked the report link in their email).
  // The rate limit allows at most one count per envelope+recipient per fixed ~7-day
  // bucket. This reliably suppresses near-term inflation from refreshes, link
  // prefetchers, and email scanners; it is not a rolling window, so `emailReports`
  // is an approximate metric rather than a strict once-per-recipient guarantee.
  const rateLimitResult = await reportSenderRateLimit.check({
    ip: ipAddress ?? 'unknown',
    identifier: `${recipient.envelopeId}:${recipient.id}`,
  });

  if (!rateLimitResult.isLimited) {
    const period = currentMonthlyPeriod();
    const { organisationId } = recipient.envelope.team;

    // Incrementing the stat is a non-critical side effect; fail soft so a transient
    // DB error never turns the confirmation page into a user-facing 500.
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
  }

  return {
    supportEmail: SUPPORT_EMAIL,
  };
}

export default function ReportSenderPage({ loaderData }: Route.ComponentProps) {
  const { supportEmail } = loaderData;

  return (
    <div className="-mx-4 flex flex-col items-center px-4 pt-16 md:-mx-8 md:px-8 lg:pt-20 xl:pt-28">
      <h1 className="max-w-[35ch] text-center font-semibold text-2xl leading-normal md:text-3xl">
        <Trans>Sender Reported</Trans>
      </h1>

      <p className="mt-4 max-w-[60ch] text-center text-muted-foreground leading-normal">
        <Trans>
          Thank you for letting us know, we have flagged this sender for review. If you have any concerns please feel
          free to reach out to our{' '}
          <a className="text-documenso-700 underline" href={`mailto:${supportEmail}`}>
            support team
          </a>
          .
        </Trans>
      </p>
    </div>
  );
}
