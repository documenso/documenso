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

  return await prisma.template.create({
    data: {
      title,
      userId,
      templateDocumentDataId,
      teamId,
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
