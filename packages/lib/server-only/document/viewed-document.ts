import { prisma } from '@documenso/prisma';
import { ReadStatus } from '@documenso/prisma/client';

export type ViewedDocumentOptions = {
  token: string;
};

export const viewedDocument = async ({ token }: ViewedDocumentOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      token,
      readStatus: ReadStatus.NOT_OPENED,
    },
  });

  if (!recipient) {
    return;
  }

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      readStatus: ReadStatus.OPENED,
    },
  });
};
