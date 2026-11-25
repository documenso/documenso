import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { lockEnvelope } from '../envelope/lock-envelope';

export interface DeleteTemplateFieldOptions {
  userId: number;
  teamId: number;
  fieldId: number;
}

export const deleteTemplateField = async ({ userId, teamId, fieldId }: DeleteTemplateFieldOptions): Promise<void> => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      envelope: {
        type: EnvelopeType.TEMPLATE,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
  });

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  // Additional validation to check visibility.
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: field.envelopeId,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  await prisma.$transaction(async (tx) => {
    await lockEnvelope(tx, field.envelopeId);

    const lockedField = await tx.field.findFirst({
      where: {
        id: field.id,
        envelope: envelopeWhereInput,
      },
    });

    if (!lockedField) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Field not found',
      });
    }

    if (lockedField.groupId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Fields in a group cannot be deleted through this endpoint. Use /envelope/field/delete instead.',
      });
    }

    await tx.field.delete({
      where: {
        id: lockedField.id,
        envelope: envelopeWhereInput,
      },
    });
  });
};
