import { omit } from 'remeda';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';
import type { TDuplicateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type DuplicateTemplateOptions = TDuplicateTemplateMutationSchema & {
  userId: number;
};

export const duplicateTemplate = async ({
  templateId,
  userId,
  teamId,
}: DuplicateTemplateOptions) => {
  let templateWhereFilter: Prisma.TemplateWhereUniqueInput = {
    id: templateId,
    userId,
    teamId: null,
  };

  if (teamId !== undefined) {
    templateWhereFilter = {
      id: templateId,
      teamId,
      team: {
        members: {
          some: {
            userId,
          },
        },
      },
    };
  }

  const template = await prisma.template.findUnique({
    where: templateWhereFilter,
    include: {
      Recipient: true,
      Field: true,
      templateDocumentData: true,
      templateMeta: true,
    },
  });

  if (!template) {
    throw new Error('Template not found.');
  }

  const documentData = await prisma.documentData.create({
    data: {
      type: template.templateDocumentData.type,
      data: template.templateDocumentData.data,
      initialData: template.templateDocumentData.initialData,
    },
  });

  let templateMeta: Prisma.TemplateCreateArgs['data']['templateMeta'] | undefined = undefined;

  if (template.templateMeta) {
    templateMeta = {
      create: {
        ...omit(template.templateMeta, ['id', 'templateId']),
        emailSettings: template.templateMeta.emailSettings || undefined,
      },
    };
  }

  const duplicatedTemplate = await prisma.template.create({
    data: {
      userId,
      teamId,
      title: template.title + ' (copy)',
      templateDocumentDataId: documentData.id,
      Recipient: {
        create: template.Recipient.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          token: nanoid(),
        })),
      },
      templateMeta,
    },
    include: {
      Recipient: true,
    },
  });

  await prisma.field.createMany({
    data: template.Field.map((field) => {
      const recipient = template.Recipient.find((recipient) => recipient.id === field.recipientId);

      const duplicatedTemplateRecipient = duplicatedTemplate.Recipient.find(
        (doc) => doc.email === recipient?.email,
      );

      if (!duplicatedTemplateRecipient) {
        throw new Error('Recipient not found.');
      }

      return {
        type: field.type,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
        customText: field.customText,
        inserted: field.inserted,
        templateId: duplicatedTemplate.id,
        recipientId: duplicatedTemplateRecipient.id,
      };
    }),
  });

  return duplicatedTemplate;
};
