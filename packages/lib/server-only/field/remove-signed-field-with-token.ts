'use server';

import { prisma } from '@documenso/prisma';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';

export type RemovedSignedFieldWithTokenOptions = {
  token: string;
  fieldId: number;
};

export const removeSignedFieldWithToken = async ({
  token,
  fieldId,
}: RemovedSignedFieldWithTokenOptions) => {
  const field = await prisma.field.findFirstOrThrow({
    where: {
      id: fieldId,
      Recipient: {
        token,
      },
    },
    include: {
      Document: true,
      Recipient: true,
    },
  });

  const { Document: document, Recipient: recipient } = field;

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error(`Document ${document.id} has already been completed`);
  }

  if (recipient?.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  // Unreachable code based on the above query but we need to satisfy TypeScript
  if (field.recipientId === null) {
    throw new Error(`Field ${fieldId} has no recipientId`);
  }

  await Promise.all([
    prisma.field.update({
      where: {
        id: field.id,
      },
      data: {
        customText: '',
        inserted: false,
      },
    }),
    prisma.signature.deleteMany({
      where: {
        fieldId: field.id,
      },
    }),
  ]);
};
