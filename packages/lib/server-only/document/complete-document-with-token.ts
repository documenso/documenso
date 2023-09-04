'use server';

import { prisma } from '@documenso/prisma';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';

import { sealDocument } from './seal-document';

export type CompleteDocumentWithTokenOptions = {
  token: string;
  documentId: number;
};

export const completeDocumentWithToken = async ({
  token,
  documentId,
}: CompleteDocumentWithTokenOptions) => {
  'use server';

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      Recipient: {
        some: {
          token,
        },
      },
    },
    include: {
      Recipient: {
        where: {
          token,
        },
      },
    },
  });

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error(`Document ${document.id} has already been completed`);
  }

  if (document.Recipient.length === 0) {
    throw new Error(`Document ${document.id} has no recipient with token ${token}`);
  }

  const [recipient] = document.Recipient;

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  const fields = await prisma.field.findMany({
    where: {
      documentId: document.id,
      recipientId: recipient.id,
    },
  });

  if (fields.some((field) => !field.inserted)) {
    throw new Error(`Recipient ${recipient.id} has unsigned fields`);
  }

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      signingStatus: SigningStatus.SIGNED,
      signedAt: new Date(),
    },
  });

  const documents = await prisma.document.updateMany({
    where: {
      id: document.id,
      Recipient: {
        every: {
          signingStatus: SigningStatus.SIGNED,
        },
      },
    },
    data: {
      status: DocumentStatus.COMPLETED,
    },
  });

  console.log('documents', documents);

  if (documents.count > 0) {
    await sealDocument({ documentId: document.id });
  }
};
