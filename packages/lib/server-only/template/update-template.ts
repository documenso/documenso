import type { DocumentVisibility, Template, TemplateMeta } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';
import { buildTeamWhereQuery } from '../../utils/teams';

export type UpdateTemplateOptions = {
  userId: number;
  teamId: number;
  templateId: number;
  data?: {
    title?: string;
    externalId?: string | null;
    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes | null;
    globalActionAuth?: TDocumentActionAuthTypes | null;
    publicTitle?: string;
    publicDescription?: string;
    type?: Template['type'];
    useLegacyFieldInsertion?: boolean;
  };
  meta?: Partial<Omit<TemplateMeta, 'id' | 'templateId'>>;
};

export const updateTemplate = async ({
  userId,
  teamId,
  templateId,
  meta = {},
  data = {},
}: UpdateTemplateOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      templateMeta: true,
      team: {
        select: {
          organisation: {
            select: {
              organisationClaim: true,
            },
          },
        },
      },
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  if (Object.values(data).length === 0 && Object.keys(meta).length === 0) {
    return template;
  }

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const documentGlobalAccessAuth = documentAuthOption?.globalAccessAuth ?? null;
  const documentGlobalActionAuth = documentAuthOption?.globalActionAuth ?? null;

  // If the new global auth values aren't passed in, fallback to the current document values.
  const newGlobalAccessAuth =
    data?.globalAccessAuth === undefined ? documentGlobalAccessAuth : data.globalAccessAuth;
  const newGlobalActionAuth =
    data?.globalActionAuth === undefined ? documentGlobalActionAuth : data.globalActionAuth;

  // Check if user has permission to set the global action auth.
  if (newGlobalActionAuth && !template.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const authOptions = createDocumentAuthOptions({
    globalAccessAuth: newGlobalAccessAuth,
    globalActionAuth: newGlobalActionAuth,
  });

  return await prisma.template.update({
    where: {
      id: templateId,
    },
    data: {
      title: data?.title,
      externalId: data?.externalId,
      type: data?.type,
      visibility: data?.visibility,
      publicDescription: data?.publicDescription,
      publicTitle: data?.publicTitle,
      useLegacyFieldInsertion: data?.useLegacyFieldInsertion,
      authOptions,
      templateMeta: {
        upsert: {
          where: {
            templateId,
          },
          create: {
            ...meta,
            emailSettings: meta?.emailSettings || undefined,
          },
          update: {
            ...meta,
            emailSettings: meta?.emailSettings || undefined,
          },
        },
      },
    },
  });
};
