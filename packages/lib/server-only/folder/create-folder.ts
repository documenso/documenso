import { prisma } from '@documenso/prisma';

import type { TFolderType } from '../../types/folder-type';
import { FolderType } from '../../types/folder-type';
import { determineDocumentVisibility } from '../../utils/document-visibility';
import { getTeamById } from '../team/get-team';
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
  const team = await getTeamById({ userId, teamId });

  const settings = await getTeamSettings({ userId, teamId });

  return await prisma.folder.create({
    data: {
      name,
      userId,
      teamId,
      parentId,
      type,
      visibility: determineDocumentVisibility(settings.documentVisibility, team.currentTeamRole),
    },
  });
};
