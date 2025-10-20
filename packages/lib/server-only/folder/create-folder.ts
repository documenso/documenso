import { prisma } from '@documenso/prisma';

import type { TFolderType } from '../../types/folder-type';
import { FolderType } from '../../types/folder-type';
import { getTeamSettings } from '../team/get-team-settings';

export interface CreateFolderOptions {
  userId: number;
  teamId: number;
  name: string;
  parentId?: string | null;
  type?: TFolderType;
}

export const createFolder = async ({
  userId,
  teamId,
  name,
  parentId,
  type = FolderType.DOCUMENT,
}: CreateFolderOptions) => {
  // This indirectly verifies whether the user has access to the team.
  const settings = await getTeamSettings({ userId, teamId });

  return await prisma.folder.create({
    data: {
      name,
      userId,
      teamId,
      parentId,
      type,
      visibility: settings.documentVisibility,
    },
  });
};
