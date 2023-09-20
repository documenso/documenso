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
  const emailData = {
    customEmailBody: emailBody,
    customEmailSubject: emailSubject,
  };

  const existingDocumentMeta = await prisma.documentMeta.findFirst({
    where: emailData,
  });

  if (existingDocumentMeta) {
    return await prisma.documentMeta.update({
      where: { id: existingDocumentMeta.id },
      data: emailData,
    });
  } else {
    return await prisma.documentMeta.create({
      data: emailData,
    });
  }
};
