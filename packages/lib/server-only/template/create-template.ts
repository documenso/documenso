import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TemplateSchema } from '@documenso/prisma/generated/zod/modelSchema//TemplateSchema';
import type { TCreateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

import { AppError, AppErrorCode } from '../../errors/app-error';

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
  let team = null;

  if (teamId) {
    team = await prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        teamGlobalSettings: true,
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }
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

  if (teamId && !team) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  return await prisma.template.create({
    data: {
      title,
      userId,
      templateDocumentDataId,
      teamId,
      folderId: folderId,
      templateMeta: {
        create: {
          language: team?.teamGlobalSettings?.documentLanguage,
          typedSignatureEnabled: team?.teamGlobalSettings?.typedSignatureEnabled ?? true,
          uploadSignatureEnabled: team?.teamGlobalSettings?.uploadSignatureEnabled ?? true,
          drawSignatureEnabled: team?.teamGlobalSettings?.drawSignatureEnabled ?? true,
        },
      },
    },
  });
};
