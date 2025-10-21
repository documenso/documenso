import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { TFolderType } from '../../types/folder-type';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export interface GetFolderByIdOptions {
  userId: number;
  teamId: number;
  folderId: string;
  type?: TFolderType;
}

export const getFolderById = async ({ userId, teamId, folderId, type }: GetFolderByIdOptions) => {
  const team = await getTeamById({ userId, teamId });

  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({ teamId, userId }),
      type,
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

  return folder;
};
