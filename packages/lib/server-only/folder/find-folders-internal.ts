import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { TFolderType } from '../../types/folder-type';
import { buildFolderAccessFilter, getUserTeamGroupIds } from '../../utils/folder-access';
import { getTeamById } from '../team/get-team';

export interface FindFoldersInternalOptions {
  userId: number;
  teamId: number;
  parentId?: string | null;
  type?: TFolderType;
}

export const findFoldersInternal = async ({
  userId,
  teamId,
  parentId,
  type,
}: FindFoldersInternalOptions) => {
  const team = await getTeamById({ userId, teamId });
  const userGroupIds = await getUserTeamGroupIds(userId, teamId);

  const accessFilter = buildFolderAccessFilter(userId, team.currentTeamRole, userGroupIds);

  const whereClause = {
    AND: [
      { parentId },
      {
        OR: [
          { teamId, ...accessFilter },
          { userId, teamId },
        ],
      },
    ],
  };

  try {
    const folders = await prisma.folder.findMany({
      where: {
        ...whereClause,
        ...(type ? { type } : {}),
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });

    const foldersWithDetails = await Promise.all(
      folders.map(async (folder) => {
        try {
          const [subfolders, documentCount, templateCount, subfolderCount] = await Promise.all([
            prisma.folder.findMany({
              where: {
                parentId: folder.id,
                teamId,
                ...accessFilter,
              },
              orderBy: {
                createdAt: 'desc',
              },
            }),
            prisma.envelope.count({
              where: {
                type: EnvelopeType.DOCUMENT,
                folderId: folder.id,
                deletedAt: null,
              },
            }),
            prisma.envelope.count({
              where: {
                type: EnvelopeType.TEMPLATE,
                folderId: folder.id,
                deletedAt: null,
              },
            }),
            prisma.folder.count({
              where: {
                parentId: folder.id,
                teamId,
                ...accessFilter,
              },
            }),
          ]);

          const subfoldersWithEmptySubfolders = subfolders.map((subfolder) => ({
            ...subfolder,
            subfolders: [],
            _count: {
              documents: 0,
              templates: 0,
              subfolders: 0,
            },
          }));

          return {
            ...folder,
            subfolders: subfoldersWithEmptySubfolders,
            _count: {
              documents: documentCount,
              templates: templateCount,
              subfolders: subfolderCount,
            },
          };
        } catch (error) {
          console.error('Error processing folder:', folder.id, error);
          throw error;
        }
      }),
    );

    return foldersWithDetails;
  } catch (error) {
    console.error('Error in findFolders:', error);
    throw error;
  }
};
