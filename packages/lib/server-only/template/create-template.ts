import type { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { TemplateSchema } from '@documenso/prisma/generated/zod/modelSchema//TemplateSchema';
import type { TCreateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type CreateTemplateOptions = TCreateTemplateMutationSchema & {
  userId: number;
  teamId?: number;
};

export const ZCreateTemplateResponseSchema = TemplateSchema;

export type TCreateTemplateResponse = z.infer<typeof ZCreateTemplateResponseSchema>;

export const createTemplate = async ({
  title,
  userId,
  teamId,
  templateDocumentDataId,
  folderId,
}: CreateTemplateOptions) => {
  if (teamId) {
    await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
    });
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        ...(teamId
          ? {
              team: {
                id: teamId,
                members: {
                  some: {
                    userId,
                  },
                },
              },
            }
          : {
              userId,
              teamId: null,
            }),
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }
  }

  return await prisma.template.create({
    data: {
      title,
      userId,
      templateDocumentDataId,
      teamId,
      folderId,
    },
  });
};
