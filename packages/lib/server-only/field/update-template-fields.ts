import type { FieldType } from '@prisma/client';

import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { buildTeamWhereQuery } from '../../utils/teams';

export interface UpdateTemplateFieldsOptions {
  userId: number;
  teamId: number;
  templateId: number;
  fields: {
    id: number;
    type?: FieldType;
    pageNumber?: number;
    pageX?: number;
    pageY?: number;
    width?: number;
    height?: number;
    fieldMeta?: TFieldMetaSchema;
  }[];
}

export const updateTemplateFields = async ({
  userId,
  teamId,
  templateId,
  fields,
}: UpdateTemplateFieldsOptions) => {
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
      message: 'Document not found',
    });
  }

  const fieldsToUpdate = fields.map((field) => {
    const originalField = template.fields.find((existingField) => existingField.id === field.id);

    if (!originalField) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field with id ${field.id} not found`,
      });
    }

    const recipient = template.recipients.find(
      (recipient) => recipient.id === originalField.recipientId,
    );

    // Each field MUST have a recipient associated with it.
    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient attached to field ${field.id} not found`,
      });
    }

    // Check whether the recipient associated with the field can be modified.
    if (!canRecipientFieldsBeModified(recipient, template.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Cannot modify a field where the recipient has already interacted with the document',
      });
    }

    return {
      updateData: field,
    };
  });

  const updatedFields = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      fieldsToUpdate.map(async ({ updateData }) => {
        const updatedField = await tx.field.update({
          where: {
            id: updateData.id,
          },
          data: {
            type: updateData.type,
            page: updateData.pageNumber,
            positionX: updateData.pageX,
            positionY: updateData.pageY,
            width: updateData.width,
            height: updateData.height,
            fieldMeta: updateData.fieldMeta,
          },
        });

        return updatedField;
      }),
    );
  });

  return {
    fields: updatedFields,
  };
};
