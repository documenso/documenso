import type { Attachment, DocumentVisibility, Template, TemplateMeta } from '@prisma/client';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';

export type UpdateTemplateOptions = {
  userId: number;
  teamId?: number;
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
    attachments?: Pick<Attachment, 'id' | 'label' | 'url'>[];
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
      attachments: true,
    },
  });

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
  if (newGlobalActionAuth) {
    const isDocumentEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isDocumentEnterprise) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to set the action auth',
      });
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
      title: data?.title,
      externalId: data?.externalId,
      type: data?.type,
      visibility: data?.visibility,
      publicDescription: data?.publicDescription,
      publicTitle: data?.publicTitle,
      useLegacyFieldInsertion: data?.useLegacyFieldInsertion,
      attachments: {
        deleteMany: {
          templateId,
          id: {
            notIn: data?.attachments?.map((attachment) => attachment.id),
          },
        },
        upsert: data?.attachments?.map((attachment) => ({
          where: {
            id: attachment.id,
            templateId,
          },
          update: {
            label: attachment.label,
            url: attachment.url,
          },
          create: {
            id: attachment.id,
            label: attachment.label,
            url: attachment.url,
          },
        })),
      },
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
