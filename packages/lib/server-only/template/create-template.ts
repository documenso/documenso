import type { DocumentVisibility, Template, TemplateMeta } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { TemplateSchema } from '@documenso/prisma/generated/zod/modelSchema//TemplateSchema';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions } from '../../utils/document-auth';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamSettings } from '../team/get-team-settings';

export type CreateTemplateOptions = {
  userId: number;
  teamId: number;
  templateDocumentDataId: string;
  data: {
    title: string;
    folderId?: string;
    externalId?: string | null;
    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes[];
    globalActionAuth?: TDocumentActionAuthTypes[];
    publicTitle?: string;
    publicDescription?: string;
    type?: Template['type'];
  };
  meta?: Partial<Omit<TemplateMeta, 'id' | 'templateId'>>;
};

export const ZCreateTemplateResponseSchema = TemplateSchema;

export type TCreateTemplateResponse = z.infer<typeof ZCreateTemplateResponseSchema>;

export const createTemplate = async ({
  userId,
  teamId,
  templateDocumentDataId,
  data,
  meta = {},
}: CreateTemplateOptions) => {
  const { title, folderId } = data;

  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({ teamId, userId }),
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
      teamId,
      userId,
      templateDocumentDataId,
      folderId,
      externalId: data.externalId,
      visibility: data.visibility ?? settings.documentVisibility,
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: data.globalAccessAuth || [],
        globalActionAuth: data.globalActionAuth || [],
      }),
      publicTitle: data.publicTitle,
      publicDescription: data.publicDescription,
      type: data.type,
      templateMeta: {
        create: {
          ...meta,
          language: meta?.language ?? settings.documentLanguage,
          typedSignatureEnabled: meta?.typedSignatureEnabled ?? settings.typedSignatureEnabled,
          uploadSignatureEnabled: meta?.uploadSignatureEnabled ?? settings.uploadSignatureEnabled,
          drawSignatureEnabled: meta?.drawSignatureEnabled ?? settings.drawSignatureEnabled,
          emailSettings: meta?.emailSettings || undefined,
        },
      },
    },
  });
};
