import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TemplateSchema } from '@documenso/prisma/generated/zod/modelSchema//TemplateSchema';
import type { TCreateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamSettings } from '../team/get-team-settings';

export type CreateTemplateOptions = TCreateTemplateMutationSchema & {
  userId: number;
  teamId: number;
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
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId),
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        teamId: team.id,
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }
  }

  const settings = await getTeamSettings({
    userId,
    teamId,
  });

  return await prisma.template.create({
    data: {
      title,
      userId,
      templateDocumentDataId,
      teamId,
      folderId: folderId,
      templateMeta: {
        create: {
          language: settings.documentLanguage,
          typedSignatureEnabled: settings.typedSignatureEnabled,
          uploadSignatureEnabled: settings.uploadSignatureEnabled,
          drawSignatureEnabled: settings.drawSignatureEnabled,
        },
      },
    },
  });
};
