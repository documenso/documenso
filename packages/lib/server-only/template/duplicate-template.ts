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
      team: buildTeamWhereQuery({ teamId, userId }),
    },
    include: {
      recipients: {
        select: {
          email: true,
          name: true,
          role: true,
          signingOrder: true,
          fields: true,
        },
      },
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
      authOptions: template.authOptions || undefined,
      visibility: template.visibility,
      templateMeta,
    },
    include: {
      recipients: true,
    },
  });

  const recipientsToCreate = template.recipients.map((recipient) => ({
    templateId: duplicatedTemplate.id,
    email: recipient.email,
    name: recipient.name,
    role: recipient.role,
    signingOrder: recipient.signingOrder,
    token: nanoid(),
    fields: {
      createMany: {
        data: recipient.fields.map((field) => ({
          templateId: duplicatedTemplate.id,
          type: field.type,
          page: field.page,
          positionX: field.positionX,
          positionY: field.positionY,
          width: field.width,
          height: field.height,
          customText: '',
          inserted: false,
          fieldMeta: field.fieldMeta as PrismaJson.FieldMeta,
        })),
      },
    },
  }));

  for (const recipientData of recipientsToCreate) {
    await prisma.recipient.create({
      data: recipientData,
    });
  }

  return duplicatedTemplate;
};
