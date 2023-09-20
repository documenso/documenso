'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentMetaOptions = {
  emailSubject: string;
  emailBody: string;
};

export const createDocumentMeta = async ({
  emailBody,
  emailSubject,
}: CreateDocumentMetaOptions) => {
  const documentMeta = await prisma.documentMeta.findFirst();

  if (!documentMeta) {
    return await prisma.documentMeta.create({
      data: {
        customEmailBody: emailBody,
        customEmailSubject: emailSubject,
      },
    });
  }

  if (emailBody && emailSubject) {
    return await prisma.documentMeta.update({
      where: {
        id: documentMeta.id,
      },
      data: {
        customEmailBody: emailBody,
        customEmailSubject: emailSubject,
      },
    });
  }
};
