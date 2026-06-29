import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import type { DocumentDataType } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { buildTeamWhereQuery } from '../../utils/teams';
import { type FontLibraryContext, type FontOwnerSelector, getVisibleFontOwners } from './font-access';
import { resolveFontDisplayName } from './font-display-name';
import {
  inferFontMimeType,
  isSupportedFontFileName,
  isSupportedFontMimeType,
  MAX_FONT_FILE_SIZE,
  parseFontFile,
} from './font-file';

type FontLibraryTarget =
  | {
      type: 'personal';
    }
  | {
      type: 'team';
      teamId: number;
    }
  | {
      type: 'organisation';
      organisationId: string;
    };

type FontUploadFile = {
  name: string;
  displayName?: string | null;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const resolveFontLibraryContext = async ({
  userId,
  target,
  requireManageAccess = false,
}: {
  userId: number;
  target: FontLibraryTarget;
  requireManageAccess?: boolean;
}): Promise<FontLibraryContext> => {
  if (target.type === 'personal') {
    return {
      type: 'personal',
      userId,
    };
  }

  if (target.type === 'team') {
    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId: target.teamId,
        userId,
        roles: requireManageAccess ? TEAM_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_TEAM : undefined,
      }),
      select: {
        id: true,
        organisationId: true,
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team not found',
      });
    }

    return {
      type: 'team',
      userId,
      teamId: team.id,
      organisationId: team.organisationId,
    };
  }

  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId: target.organisationId,
      userId,
      roles: requireManageAccess ? ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_ORGANISATION : undefined,
    }),
    select: {
      id: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  return {
    type: 'organisation',
    organisationId: organisation.id,
  };
};

const getOwnerCreateData = (context: FontLibraryContext) => {
  if (context.type === 'personal') {
    return {
      userId: context.userId,
    };
  }

  if (context.type === 'team') {
    return {
      teamId: context.teamId,
    };
  }

  return {
    organisationId: context.organisationId,
  };
};

const getVisibleFontWhere = (context: FontLibraryContext) => {
  return {
    OR: getVisibleFontOwners(context),
  };
};

const isFontOwnerMatch = (
  fontAsset: { userId: number | null; teamId: number | null; organisationId: string | null },
  owner: FontOwnerSelector,
) => {
  if ('userId' in owner) {
    return fontAsset.userId === owner.userId;
  }

  if ('teamId' in owner) {
    return fontAsset.teamId === owner.teamId;
  }

  return fontAsset.organisationId === owner.organisationId;
};

export const isFontAssetVisibleToContext = (
  fontAsset: { userId: number | null; teamId: number | null; organisationId: string | null },
  context: FontLibraryContext,
) => {
  return getVisibleFontOwners(context).some((owner) => isFontOwnerMatch(fontAsset, owner));
};

export const listFontAssets = async ({ userId, target }: { userId: number; target: FontLibraryTarget }) => {
  const context = await resolveFontLibraryContext({
    userId,
    target,
  });

  return await prisma.fontAsset.findMany({
    where: getVisibleFontWhere(context),
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  });
};

export const createFontAsset = async ({
  userId,
  target,
  file,
}: {
  userId: number;
  target: FontLibraryTarget;
  file: FontUploadFile;
}) => {
  if (file.size > MAX_FONT_FILE_SIZE) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'Font file is too large',
    });
  }

  if (!isSupportedFontFileName(file.name)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Unsupported font file type',
    });
  }

  const context = await resolveFontLibraryContext({
    userId,
    target,
    requireManageAccess: true,
  });

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes.byteLength > MAX_FONT_FILE_SIZE) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'Font file is too large',
    });
  }

  const mimeType = file.type || inferFontMimeType(file.name);

  if (!isSupportedFontMimeType(mimeType)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Unsupported font file type',
    });
  }

  const parsedFont = parseFontFile({
    bytes,
    fallbackName: file.name,
  });

  const storedFile = await putFileServerSide({
    name: file.name,
    type: mimeType,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });

  return await prisma.fontAsset.create({
    data: {
      ...getOwnerCreateData(context),
      name: resolveFontDisplayName({
        displayName: file.displayName,
        parsedName: parsedFont.name,
      }),
      family: parsedFont.family,
      fileName: file.name,
      mimeType,
      fileSize: bytes.byteLength,
      dataType: storedFile.type,
      data: storedFile.data,
    },
  });
};

const getFontAssetFileFromAsset = async (fontAsset: {
  dataType: DocumentDataType;
  data: string;
  mimeType: string;
  [key: string]: unknown;
}) => {
  if (!fontAsset) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Font not found',
    });
  }

  return {
    fontAsset,
    bytes: await getFileServerSide({
      type: fontAsset.dataType,
      data: fontAsset.data,
    }),
  };
};

export const getFontAssetFileForUser = async ({ userId, fontId }: { userId: number; fontId: string }) => {
  const fontAsset = await prisma.fontAsset.findFirst({
    where: {
      id: fontId,
      OR: [
        {
          userId,
        },
        {
          team: buildTeamWhereQuery({
            teamId: undefined,
            userId,
          }),
        },
        {
          organisation: buildOrganisationWhereQuery({
            organisationId: undefined,
            userId,
          }),
        },
      ],
    },
  });

  if (!fontAsset) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Font not found',
    });
  }

  return await getFontAssetFileFromAsset(fontAsset);
};

export const getFontAssetFileForRecipientToken = async ({ fontId, token }: { fontId: string; token: string }) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      token,
    },
    select: {
      envelope: {
        select: {
          userId: true,
          teamId: true,
          team: {
            select: {
              organisationId: true,
            },
          },
        },
      },
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Font not found',
    });
  }

  const fontAsset = await prisma.fontAsset.findFirst({
    where: {
      id: fontId,
      ...getVisibleFontWhere({
        type: 'team',
        userId: recipient.envelope.userId,
        teamId: recipient.envelope.teamId,
        organisationId: recipient.envelope.team.organisationId,
      }),
    },
  });

  if (!fontAsset) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Font not found',
    });
  }

  return await getFontAssetFileFromAsset(fontAsset);
};

export const deleteFontAsset = async ({ userId, fontId }: { userId: number; fontId: string }) => {
  const fontAsset = await prisma.fontAsset.findFirst({
    where: {
      id: fontId,
      OR: [
        {
          userId,
        },
        {
          team: buildTeamWhereQuery({
            teamId: undefined,
            userId,
            roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_TEAM,
          }),
        },
        {
          organisation: buildOrganisationWhereQuery({
            organisationId: undefined,
            userId,
            roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_ORGANISATION,
          }),
        },
      ],
    },
  });

  if (!fontAsset) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Font not found',
    });
  }

  const referencedField = await prisma.field.findFirst({
    where: {
      fieldMeta: {
        path: ['fontFamily'],
        equals: fontAsset.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (referencedField) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Font is still used by one or more fields',
    });
  }

  await prisma.fontAsset.delete({
    where: {
      id: fontAsset.id,
    },
  });
};

export const isUploadedFontAssetId = (fontFamily: string | undefined | null) => {
  return Boolean(fontFamily && /^[A-Za-z0-9_-]+$/.test(fontFamily));
};

export const getFontAssetBytesForField = async (fontFamily: string | undefined | null, context: FontLibraryContext) => {
  if (!isUploadedFontAssetId(fontFamily)) {
    return null;
  }

  const fontAsset = await prisma.fontAsset.findUnique({
    where: {
      id: fontFamily ?? '',
    },
  });

  if (!fontAsset) {
    return null;
  }

  if (!isFontAssetVisibleToContext(fontAsset, context)) {
    return null;
  }

  const bytes = await getFileServerSide({
    type: fontAsset.dataType,
    data: fontAsset.data,
  });

  return {
    fontAsset,
    bytes,
  };
};
