import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';
import {
  DocumentDataSchema,
  FieldSchema,
  RecipientSchema,
  TemplateDirectLinkSchema,
  TemplateMetaSchema,
  TemplateSchema,
  UserSchema,
} from '@documenso/prisma/generated/zod';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetTemplateByIdOptions = {
  id: number;
  userId: number;
  teamId?: number;
};

export const ZGetTemplateByIdResponseSchema = TemplateSchema.extend({
  directLink: TemplateDirectLinkSchema.nullable(),
  templateDocumentData: DocumentDataSchema,
  templateMeta: TemplateMetaSchema.nullable(),
  Recipient: RecipientSchema.array(),
  Field: FieldSchema.array(),
  User: UserSchema.pick({
    id: true,
    name: true,
    email: true,
  }),
});

export type TGetTemplateByIdResponse = z.infer<typeof ZGetTemplateByIdResponseSchema>;

export const getTemplateById = async ({
  id,
  userId,
  teamId,
}: GetTemplateByIdOptions): Promise<TGetTemplateByIdResponse> => {
  const whereFilter: Prisma.TemplateWhereInput = {
    id,
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
  };

  const template = await prisma.template.findFirst({
    where: whereFilter,
    include: {
      directLink: true,
      templateDocumentData: true,
      templateMeta: true,
      Recipient: true,
      Field: true,
      User: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  return template;
};
