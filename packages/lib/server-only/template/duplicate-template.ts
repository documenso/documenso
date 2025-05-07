import type { Prisma } from '@prisma/client';
import { omit } from 'remeda';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { TDuplicateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

import { buildTeamWhereQuery } from '../../utils/teams';

export type DuplicateTemplateOptions = TDuplicateTemplateMutationSchema & {
  userId: number;
  teamId: number;
};

export const duplicateTemplate = async ({
  templateId,
  userId,
  teamId,
}: DuplicateTemplateOptions) => {
  const template = await prisma.template.findUnique({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      recipients: true,
      fields: true,
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
      recipients: {
        create: template.recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          token: nanoid(),
        })),
      },
      templateMeta,
    },
    include: {
      recipients: true,
    },
  });

  await prisma.field.createMany({
    data: template.fields.map((field) => {
      const recipient = template.recipients.find((recipient) => recipient.id === field.recipientId);

      const duplicatedTemplateRecipient = duplicatedTemplate.recipients.find(
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
