import { DateTime } from 'luxon';

import { reregisterEmailDomain } from '@documenso/ee/server-only/lib/reregister-email-domain';
import { verifyEmailDomain } from '@documenso/ee/server-only/lib/verify-email-domain';
import { prisma } from '@documenso/prisma';

import type { JobRunIO } from '../../client/_internal/job';
import type { TSyncEmailDomainsJobDefinition } from './sync-email-domains';

const BATCH_SIZE = 10;
const AUTO_REREGISTER_AFTER_HOURS = 48;

export const run = async ({ io }: { payload: TSyncEmailDomainsJobDefinition; io: JobRunIO }) => {
  const pendingDomains = await prisma.emailDomain.findMany({
    where: {
      status: 'PENDING',
    },
    select: {
      id: true,
      domain: true,
      createdAt: true,
      lastVerifiedAt: true,
    },
    orderBy: {
      lastVerifiedAt: { sort: 'asc', nulls: 'first' },
    },
  });

  if (pendingDomains.length === 0) {
    io.logger.info('No pending email domains to sync');
    return;
  }

  io.logger.info(`Found ${pendingDomains.length} pending email domains to sync`);

  let verifiedCount = 0;
  let reregisteredCount = 0;
  let errorCount = 0;

  const reregisterCutoff = DateTime.now().minus({ hours: AUTO_REREGISTER_AFTER_HOURS }).toJSDate();

  for (let i = 0; i < pendingDomains.length; i += BATCH_SIZE) {
    const batch = pendingDomains.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (domain) => {
        const shouldReregister = domain.createdAt < reregisterCutoff;

        if (shouldReregister) {
          io.logger.info(
            `Domain "${domain.domain}" has been pending since ${domain.createdAt.toISOString()}, attempting re-registration`,
          );

          await reregisterEmailDomain({ emailDomainId: domain.id });
          return 'reregistered' as const;
        }

        const { isVerified } = await verifyEmailDomain(domain.id);

        return isVerified ? ('verified' as const) : ('pending' as const);
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        errorCount++;
        io.logger.error(`Failed to process email domain: ${String(result.reason)}`);
      } else if (result.value === 'verified') {
        verifiedCount++;
      } else if (result.value === 'reregistered') {
        reregisteredCount++;
      }
    }

    // Small delay between batches to respect SES API rate limits.
    if (i + BATCH_SIZE < pendingDomains.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
  }

  io.logger.info(
    `Sync complete: ${verifiedCount} verified, ${reregisteredCount} re-registered, ${errorCount} errors out of ${pendingDomains.length} pending domains`,
  );
};
