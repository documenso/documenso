import type { Field } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type GetFieldByIdOptions = {
  userId: number;
  teamId?: number;
  fieldId: number;
  documentId?: number;
  templateId?: number;
};

export const getFieldById = async ({
  userId,
  teamId,
  fieldId,
  documentId,
  templateId,
}: GetFieldByIdOptions) => {
  let field: Field | null = null;

  if (documentId) {
    field = await prisma.field.findFirst({
      where: {
        id: fieldId,
        document: {
          id: documentId,
          team: buildTeamWhereQuery(teamId, userId),
        },
      },
    });
  }

  if (templateId) {
    field = await prisma.field.findFirst({
      where: {
        id: fieldId,
        template: {
          id: templateId,
          team: buildTeamWhereQuery(teamId, userId),
        },
      },
    });
  }

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  return field;
};
