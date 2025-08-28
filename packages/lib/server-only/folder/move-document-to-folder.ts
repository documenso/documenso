import type { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { FolderType } from '@documenso/lib/types/folder-type';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface MoveDocumentToFolderOptions {
  userId: number;
  teamId: number;
  documentId: number;
  folderId?: string | null;
  requestMetadata?: ApiRequestMetadata;
}

export const moveDocumentToFolder = async ({
  userId,
  teamId,
  documentId,
  folderId,
}: MoveDocumentToFolderOptions) => {
  const { envelopeWhereInput, team } = await getEnvelopeWhereInput({
    id: {
      type: 'documentId',
      id: documentId,
    },
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (folderId) {
    const folderWhereClause: Prisma.FolderWhereInput = {
      id: folderId,
      type: FolderType.DOCUMENT,
      OR: [
        {
          teamId: team.id,
          visibility: {
            in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
          },
        },
        {
          userId,
          teamId: team.id,
        },
      ],
    };

    const folder = await prisma.folder.findFirst({
      where: folderWhereClause,
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }
  }

  return await prisma.envelope.update({
    where: {
      id: envelope.id,
    },
    data: {
      folderId,
    },
  });
};
