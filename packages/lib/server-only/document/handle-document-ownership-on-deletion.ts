import { deletedAccountServiceAccount } from '@documenso/lib/server-only/user/service-accounts/deleted-account';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

type MoveDocumentsOptions = {
  documentIds: number[];
  organisationOwnerId: number;
};

export const handleDocumentOwnershipOnDeletion = async ({
  documentIds,
  organisationOwnerId,
}: MoveDocumentsOptions) => {
  if (documentIds.length === 0) {
    return;
  }

  const serviceAccount = await deletedAccountServiceAccount();
  const serviceAccountTeam = serviceAccount.ownedOrganisations[0].teams[0];

  await prisma.document.deleteMany({
    where: {
      id: {
        in: documentIds,
      },
      status: DocumentStatus.DRAFT,
    },
  });

  const organisationOwner = await prisma.user.findUnique({
    where: {
      id: organisationOwnerId,
    },
    include: {
      ownedOrganisations: {
        include: {
          teams: true,
        },
      },
    },
  });

  if (organisationOwner && organisationOwner.ownedOrganisations.length > 0) {
    const ownerPersonalTeam = organisationOwner.ownedOrganisations[0].teams[0];

    await prisma.document.updateMany({
      where: {
        id: {
          in: documentIds,
        },
        status: {
          not: DocumentStatus.DRAFT,
        },
      },
      data: {
        userId: organisationOwner.id,
        teamId: ownerPersonalTeam.id,
        deletedAt: new Date(),
      },
    });
  } else {
    await prisma.document.updateMany({
      where: {
        id: {
          in: documentIds,
        },
        status: {
          not: DocumentStatus.DRAFT,
        },
      },
      data: {
        userId: serviceAccount.id,
        teamId: serviceAccountTeam.id,
        deletedAt: new Date(),
      },
    });
  }
};
