import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

type GetNextInboxDocumentOptions = {
  email: string | undefined;
};

export const getNextInboxDocument = async ({ email }: GetNextInboxDocumentOptions) => {
  if (!email) {
    throw new Error('User is required');
  }

  return await prisma.document.findFirst({
    where: {
      Recipient: {
        some: {
          email,
          signingStatus: SigningStatus.NOT_SIGNED,
          role: {
            not: RecipientRole.CC,
          },
        },
      },
      status: { not: DocumentStatus.DRAFT },
      deletedAt: null,
    },
    select: {
      createdAt: true,
      title: true,
      Recipient: {
        where: {
          email,
        },
        select: {
          token: true,
        },
      },
      documentMeta: true,
    },
    orderBy: [{ createdAt: 'asc' }],
  });
};
