'use server';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import type { Template, TemplateMeta } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';

export type UpdateTemplateSettingsOptions = {
  userId: number;
  teamId?: number;
  templateId: number;
  data: {
    title?: string;
    externalId?: string | null;
    globalAccessAuth?: TDocumentAccessAuthTypes | null;
    globalActionAuth?: TDocumentActionAuthTypes | null;
    publicTitle?: string;
    publicDescription?: string;
    type?: Template['type'];
  };
  meta?: Partial<Omit<TemplateMeta, 'id' | 'templateId'>>;
  requestMetadata?: RequestMetadata;
};

export const updateTemplateSettings = async ({
  userId,
  teamId,
  templateId,
  meta,
  data,
}: UpdateTemplateSettingsOptions) => {
  if (Object.values(data).length === 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, 'Missing data to update');
  }

  const template = await prisma.template.findFirstOrThrow({
    where: {
      id: templateId,
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
    include: {
      templateMeta: true,
    },
  });

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
  if (newGlobalActionAuth) {
    const isDocumentEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isDocumentEnterprise) {
      throw new AppError(
        AppErrorCode.UNAUTHORIZED,
        'You do not have permission to set the action auth',
      );
    }
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
      title: data.title,
      externalId: data.externalId || null,
      type: data.type,
      publicDescription: data.publicDescription,
      publicTitle: data.publicTitle,
      authOptions,
      templateMeta: {
        upsert: {
          where: {
            templateId,
          },
          create: {
            ...meta,
          },
          update: {
            ...meta,
          },
        },
      },
    },
  });
};
