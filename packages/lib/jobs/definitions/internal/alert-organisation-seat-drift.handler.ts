import { mailer } from '@documenso/email/mailer';
import { prisma } from '@documenso/prisma';
import { IS_BILLING_ENABLED, SUPPORT_EMAIL } from '../../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../../constants/email';
import type { JobRunIO } from '../../client/_internal/job';
import type { TAlertOrganisationSeatDriftJobDefinition } from './alert-organisation-seat-drift';

/**
 * Daily check for organisations whose member count exceeds their paid seat
 * count (`organisationClaim.memberCount`, where `0` means unlimited).
 */
export const run = async ({ io }: { payload: TAlertOrganisationSeatDriftJobDefinition; io: JobRunIO }) => {
  if (!IS_BILLING_ENABLED()) {
    return;
  }

  const organisations = await prisma.organisation.findMany({
    where: {
      // Exclude unlimited-seat plans (memberCount === 0).
      organisationClaim: {
        memberCount: {
          not: 0,
        },
      },
    },
    select: {
      id: true,
      name: true,
      organisationClaim: {
        select: {
          memberCount: true,
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
  });

  const driftedOrganisations = organisations.filter(
    (organisation) =>
      organisation.organisationClaim !== null &&
      organisation._count.members > organisation.organisationClaim.memberCount,
  );

  if (driftedOrganisations.length === 0) {
    io.logger.info('No organisations exceed their paid seat count');

    return;
  }

  await mailer.sendMail({
    to: SUPPORT_EMAIL,
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject: `[Billing] ${driftedOrganisations.length} organisation(s) exceed their paid seat count`,
    text: [
      `${driftedOrganisations.length} organisation(s) have more members than their paid seat count:`,
      '',
      ...driftedOrganisations.map(
        (organisation) =>
          `- ${organisation.name} (${organisation.id}): ${organisation._count.members} members vs ${organisation.organisationClaim?.memberCount ?? 0} paid seats`,
      ),
    ].join('\n'),
  });
};
