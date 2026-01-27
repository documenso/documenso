import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { deletedAccountServiceAccount } from '../user/service-accounts/deleted-account';

export type OrphanEnvelopesOptions = {
  teamId: number;
};

export const orphanEnvelopes = async ({ teamId }: OrphanEnvelopesOptions) => {
  const serviceAccount = await deletedAccountServiceAccount();

  // Transfer all inflight and completed envelopes to the service account.
  await prisma.envelope.updateMany({
    where: {
      teamId,
      type: EnvelopeType.DOCUMENT,
      status: {
        in: [DocumentStatus.PENDING, DocumentStatus.REJECTED, DocumentStatus.COMPLETED],
      },
      deletedAt: null,
    },
    data: {
      userId: serviceAccount.id,
      teamId: serviceAccount.ownedOrganisations[0].teams[0].id,
      deletedAt: new Date(),
    },
  });

  // Transfer any remaining deleted envelopes to the service account.
  await prisma.envelope.updateMany({
    where: {
      teamId,
      type: EnvelopeType.DOCUMENT,
      status: {
        in: [DocumentStatus.PENDING, DocumentStatus.REJECTED, DocumentStatus.COMPLETED],
      },
    },
    data: {
      userId: serviceAccount.id,
      teamId: serviceAccount.ownedOrganisations[0].teams[0].id,
    },
  });

  // Then delete anything remaining across documents and templates.
  await prisma.envelope.deleteMany({
    where: {
      teamId,
    },
  });
};
