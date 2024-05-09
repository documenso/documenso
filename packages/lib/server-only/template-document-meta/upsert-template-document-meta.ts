'use server';

import { prisma } from '@documenso/prisma';

export type CreateTemplateDocumentMetaOptions = {
  templateId: number;
  subject?: string;
  message?: string;
  timezone?: string;
  password?: string;
  dateFormat?: string;
  redirectUrl?: string;
};

export const upsertTemplateDocumentMeta = async ({
  subject,
  message,
  timezone,
  dateFormat,
  templateId,
  password,
  redirectUrl,
}: CreateTemplateDocumentMetaOptions) => {
  const templateDocumentMeta = await prisma.templateDocumentMeta.findFirstOrThrow({
    where: {
      templateId: templateId,
    },
    include: {
      template: true,
    },
  });
  return await prisma.$transaction(async (tx) => {
    const upsertedTemplateDocumentMeta = await tx.templateDocumentMeta.upsert({
      where: {
        templateId,
      },
      update: {
        subject,
        message,
        timezone,
        password,
        dateFormat,
        redirectUrl,
      },
      create: {
        templateId,
        subject,
        message,
        timezone,
        password,
        dateFormat,
        redirectUrl,
      },
    });

    return upsertedTemplateDocumentMeta;
  });
};
