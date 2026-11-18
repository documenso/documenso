import { prisma } from '@documenso/prisma';

import { jobsClient } from '../../jobs/client';
import { logger } from '../../utils/logger';
import { shouldDisableReportedSender } from '../../utils/sender-trust';
import { disableUser } from './disable-user';

export type DisableReportedSenderOptions = {
  envelopeId: string;
};

export const disableReportedSender = async ({ envelopeId }: DisableReportedSenderOptions): Promise<boolean> => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          disabled: true,
          roles: true,
        },
      },
      team: {
        select: {
          organisation: {
            select: {
              organisationClaim: {
                select: {
                  originalSubscriptionClaimId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    return false;
  }

  const { user } = envelope;
  const { organisationClaim } = envelope.team.organisation;

  if (!shouldDisableReportedSender({ user, organisationClaim })) {
    return false;
  }

  await disableUser({ id: user.id });

  logger.warn({
    msg: 'Sender automatically disabled after a signing request was reported',
    userId: user.id,
    envelopeId: envelope.id,
  });

  await jobsClient.triggerJob({
    name: 'send.account.disabled.email',
    payload: {
      userId: user.id,
      reason: 'SIGNING_REQUEST_REPORTED',
      envelopeId: envelope.id,
    },
  });

  return true;
};
