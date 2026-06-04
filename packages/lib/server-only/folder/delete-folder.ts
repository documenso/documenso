import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildFolderAccessFilter, getUserTeamGroupIds } from '../../utils/folder-access';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export interface DeleteFolderOptions {
  userId: number;
  teamId: number;
  folderId: string;
}

export const deleteFolder = async ({ userId, teamId, folderId }: DeleteFolderOptions) => {
  const team = await getTeamById({ userId, teamId });
  const userGroupIds = await getUserTeamGroupIds(userId, teamId);

  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
      ...buildFolderAccessFilter(userId, team.currentTeamRole, userGroupIds),
    },
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  // buildFolderAccessFilter already gates access in the query above: it honors the
  // folder creator, per-user ACLs (allowedUserIds), per-group ACLs (allowedGroupIds),
  // and role-based visibility tiers. A user with no access never reaches this point
  // (folder is null -> NOT_FOUND), so no second, ACL-blind permission check is needed.
  return await prisma.folder.delete({
    where: {
      id: folder.id,
    },
  });
};
