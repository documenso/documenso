import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { FieldSchema } from '@documenso/prisma/generated/zod';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetFieldByIdOptions = {
  userId: number;
  teamId?: number;
  fieldId: number;
  documentId?: number;
  templateId?: number;
};

export const ZGetFieldByIdResponseSchema = FieldSchema;

export type TGetFieldByIdResponse = z.infer<typeof ZGetFieldByIdResponseSchema>;

export const getFieldById = async ({
  userId,
  teamId,
  fieldId,
  documentId,
  templateId,
}: GetFieldByIdOptions): Promise<TGetFieldByIdResponse> => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      documentId,
      templateId,
      document: {
        OR:
          teamId === undefined
            ? [
                {
                  userId,
                  teamId: null,
                },
              ]
            : [
                {
                  teamId,
                  team: {
                    members: {
                      some: {
                        userId,
                      },
                    },
                  },
                },
              ],
      },
    },
  });

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  return field;
};
