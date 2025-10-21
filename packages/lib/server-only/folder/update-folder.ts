import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import type { DocumentVisibility } from '@documenso/prisma/generated/types';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export interface UpdateFolderOptions {
  userId: number;
  teamId: number;
  folderId: string;
  data: {
    parentId?: string | null;
    name?: string;
    visibility?: DocumentVisibility;
    pinned?: boolean;
  };
}

export const updateFolder = async ({ userId, teamId, folderId, data }: UpdateFolderOptions) => {
  const { parentId, name, visibility, pinned } = data;

  const team = await getTeamById({ userId, teamId });

  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
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

  return await prisma.folder.update({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
    },
    data: {
      name,
      visibility,
      parentId,
      pinned,
    },
  });
};
