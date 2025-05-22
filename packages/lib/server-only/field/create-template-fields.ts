import type { FieldType } from '@prisma/client';

import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { buildTeamWhereQuery } from '../../utils/teams';

export interface CreateTemplateFieldsOptions {
  userId: number;
  teamId: number;
  templateId: number;
  fields: {
    recipientId: number;
    type: FieldType;
    pageNumber: number;
    pageX: number;
    pageY: number;
    width: number;
    height: number;
    fieldMeta?: TFieldMetaSchema;
  }[];
}

export const createTemplateFields = async ({
  userId,
  teamId,
  templateId,
  fields,
}: CreateTemplateFieldsOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      recipients: true,
      fields: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'template not found',
    });
  }

  // Field validation.
  const validatedFields = fields.map((field) => {
    const recipient = template.recipients.find((recipient) => recipient.id === field.recipientId);

    // Each field MUST have a recipient associated with it.
    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${field.recipientId} not found`,
      });
    }

    // Check whether the recipient associated with the field can have new fields created.
    if (!canRecipientFieldsBeModified(recipient, template.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Recipient type cannot have fields, or they have already interacted with the template.',
      });
    }

    return {
      ...field,
      recipientEmail: recipient.email,
    };
  });

  const createdFields = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      validatedFields.map(async (field) => {
        const createdField = await tx.field.create({
          data: {
            type: field.type,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            width: field.width,
            height: field.height,
            customText: '',
            inserted: false,
            fieldMeta: field.fieldMeta,
            templateId,
            recipientId: field.recipientId,
          },
        });

        return createdField;
      }),
    );
  });

  return {
    fields: createdFields,
  };
};
