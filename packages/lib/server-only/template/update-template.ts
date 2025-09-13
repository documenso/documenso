import type { Prisma, TemplateType } from '@prisma/client';
import {
  type DocumentMeta,
  type DocumentVisibility,
  EnvelopeType,
  FolderType,
} from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import { createDocumentAuthOptions, extractDocumentAuthMethods } from '../../utils/document-auth';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type UpdateTemplateOptions = {
  userId: number;
  teamId: number;
  templateId: number;
  data?: {
    title?: string;
    folderId?: string | null;
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
  const { envelopeWhereInput, team } = await getEnvelopeWhereInput({
    id: {
      type: 'templateId',
      id: templateId,
    },
    type: EnvelopeType.TEMPLATE,
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

  let folderUpdateQuery: Prisma.FolderUpdateOneWithoutEnvelopesNestedInput | undefined = undefined;

  // Validate folder ID.
  if (data.folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: data.folderId,
        team: buildTeamWhereQuery({
          teamId,
          userId,
        }),
        type: FolderType.TEMPLATE,
        visibility: {
          in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
        },
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }

    folderUpdateQuery = {
      connect: {
        id: data.folderId,
      },
    };
  }

  // Move template to root folder if folderId is null.
  if (data.folderId === null) {
    folderUpdateQuery = {
      disconnect: true,
    };
  }

  return await prisma.envelope.update({
    where: {
      id: envelope.id,
      type: EnvelopeType.TEMPLATE,
    },
    data: {
      templateType: data?.type,
      title: data?.title,
      externalId: data?.externalId,
      visibility: data?.visibility,
      publicDescription: data?.publicDescription,
      publicTitle: data?.publicTitle,
      useLegacyFieldInsertion: data?.useLegacyFieldInsertion,
      folder: folderUpdateQuery,
      authOptions,
      documentMeta: {
        update: {
          ...meta,
          emailSettings: meta?.emailSettings || undefined,
        },
      },
    },
  });
};
