import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { TFolderType } from '../../types/folder-type';
import type { FindResultResponse } from '../../types/search-params';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export interface FindFoldersOptions {
  userId: number;
  teamId: number;
  parentId?: string | null;
  type?: TFolderType;
  page?: number;
  perPage?: number;
}

export const findFolders = async ({
  userId,
  teamId,
  parentId,
  type,
  page = 1,
  perPage = 10,
}: FindFoldersOptions) => {
  const team = await getTeamById({ userId, teamId });

  const whereClause: Prisma.FolderWhereInput = {
    parentId,
    team: buildTeamWhereQuery({ teamId, userId }),
    type,
    visibility: {
      in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
    },
  };

  const [data, count] = await Promise.all([
    prisma.folder.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.folder.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
