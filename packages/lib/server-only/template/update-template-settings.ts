'use server';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import type { TemplateMeta } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';

export type UpdateTemplateSettingsOptions = {
  userId: number;
  teamId?: number;
  templateId: number;
  data: {
    title?: string;
    globalAccessAuth?: TDocumentAccessAuthTypes | null;
    globalActionAuth?: TDocumentActionAuthTypes | null;
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
  if (!data.title && !data.globalAccessAuth && !data.globalActionAuth) {
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

  const { templateMeta } = template;

  const isDateSame = (templateMeta?.dateFormat || null) === (meta?.dateFormat || null);
  const isMessageSame = (templateMeta?.message || null) === (meta?.message || null);
  const isPasswordSame = (templateMeta?.password || null) === (meta?.password || null);
  const isSubjectSame = (templateMeta?.subject || null) === (meta?.subject || null);
  const isRedirectUrlSame = (templateMeta?.redirectUrl || null) === (meta?.redirectUrl || null);
  const isTimezoneSame = (templateMeta?.timezone || null) === (meta?.timezone || null);

  // Early return to avoid unnecessary updates.
  if (
    template.title === data.title &&
    data.globalAccessAuth === documentAuthOption.globalAccessAuth &&
    data.globalActionAuth === documentAuthOption.globalActionAuth &&
    isDateSame &&
    isMessageSame &&
    isPasswordSame &&
    isSubjectSame &&
    isRedirectUrlSame &&
    isTimezoneSame
  ) {
    return template;
  }

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
