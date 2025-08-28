import { type DocumentMeta, type DocumentVisibility, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import type { TemplateType } from '@documenso/prisma/types/template-legacy-schema';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type UpdateTemplateOptions = {
  userId: number;
  teamId: number;
  templateId: number;
  data?: {
    title?: string;
    externalId?: string | null;
    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes[];
    globalActionAuth?: TDocumentActionAuthTypes[];
    publicTitle?: string;
    publicDescription?: string;
    type?: TemplateType;
    useLegacyFieldInsertion?: boolean;
  };
  meta?: Partial<Omit<DocumentMeta, 'id' | 'templateId'>>;
};

export const updateTemplate = async ({
  userId,
  teamId,
  templateId,
  meta = {},
  data = {},
}: UpdateTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'templateId',
      id: templateId,
    },
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      documentMeta: true,
      team: {
        select: {
          organisationId: true,
          organisation: {
            select: {
              organisationClaim: true,
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  if (Object.values(data).length === 0 && Object.keys(meta).length === 0) {
    return envelope;
  }

  const { documentAuthOption } = extractDocumentAuthMethods({
    documentAuth: envelope.authOptions,
  });

  const documentGlobalAccessAuth = documentAuthOption?.globalAccessAuth ?? null;
  const documentGlobalActionAuth = documentAuthOption?.globalActionAuth ?? null;

  // If the new global auth values aren't passed in, fallback to the current document values.
  const newGlobalAccessAuth =
    data?.globalAccessAuth === undefined ? documentGlobalAccessAuth : data.globalAccessAuth;
  const newGlobalActionAuth =
    data?.globalActionAuth === undefined ? documentGlobalActionAuth : data.globalActionAuth;

  // Check if user has permission to set the global action auth.
  if (newGlobalActionAuth.length > 0 && !envelope.team.organisation.organisationClaim.flags.cfr21) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const authOptions = createDocumentAuthOptions({
    globalAccessAuth: newGlobalAccessAuth,
    globalActionAuth: newGlobalActionAuth,
  });

  const emailId = meta.emailId;

  // Validate the emailId belongs to the organisation.
  if (emailId) {
    const email = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisationId: envelope.team.organisationId,
      },
    });

    if (!email) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email not found',
      });
    }
  }

  return await prisma.envelope.update({
    where: {
      id: envelope.id,
    },
    data: {
      type: EnvelopeType.TEMPLATE,
      templateType: data?.type,
      title: data?.title,
      externalId: data?.externalId,
      visibility: data?.visibility,
      publicDescription: data?.publicDescription,
      publicTitle: data?.publicTitle,
      useLegacyFieldInsertion: data?.useLegacyFieldInsertion,
      authOptions,
      documentMeta: {
        create: {
          ...meta,
          emailSettings: meta?.emailSettings || undefined,
        },
      },
    },
  });
};
