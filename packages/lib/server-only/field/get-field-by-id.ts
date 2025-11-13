import type { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { mapFieldToLegacyField } from '../../utils/fields';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type GetFieldByIdOptions = {
  userId: number;
  teamId: number;
  fieldId: number;
  envelopeType?: EnvelopeType;
};

export const getFieldById = async ({
  userId,
  teamId,
  fieldId,
  envelopeType,
}: GetFieldByIdOptions) => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      envelope: {
        type: envelopeType,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    },
  });

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: field.envelopeId,
    },
    type: envelopeType ?? null,
    userId,
    teamId,
  });

  // Additional validation to check visibility.
  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  return mapFieldToLegacyField(field, envelope);
};
