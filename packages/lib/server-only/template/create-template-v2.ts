import type { DocumentVisibility, Template, TemplateMeta } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuthOptions } from '../../utils/document-auth';
import { buildTeamWhereQuery } from '../../utils/teams';

export type CreateTemplateV2Options = {
  userId: number;
  teamId: number;
  folderId?: string;
  templateDocumentDataId: string;
  data: {
    title: string;
    externalId?: string | null;
    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes[];
    globalActionAuth?: TDocumentActionAuthTypes[];
    publicTitle?: string;
    publicDescription?: string;
    type?: Template['type'];
    useLegacyFieldInsertion?: boolean;
  };
  meta: Partial<Omit<TemplateMeta, 'id' | 'templateId'>>;
  requestMetadata: ApiRequestMetadata;
};

export const createTemplateV2 = async ({
  userId,
  teamId,
  folderId,
  templateDocumentDataId,
  data,
  meta = {},
}: CreateTemplateV2Options) => {
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

  console.log('data inside create template v2', data);

  return await prisma.template.create({
    data: {
      title: data?.title,
      teamId,
      userId,
      templateDocumentDataId,
      externalId: data?.externalId,
      useLegacyFieldInsertion: data?.useLegacyFieldInsertion,
      visibility: data?.visibility,
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: data?.globalAccessAuth || [],
        globalActionAuth: data?.globalActionAuth || [],
      }),
      publicTitle: data?.publicTitle,
      publicDescription: data?.publicDescription,
      type: data?.type,
      templateMeta: {
        create: {
          ...meta,
          emailSettings: meta?.emailSettings || undefined,
        },
      },
    },
  });
};
