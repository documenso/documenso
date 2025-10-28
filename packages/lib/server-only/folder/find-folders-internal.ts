import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { TFolderType } from '../../types/folder-type';
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

  const visibilityFilters = {
    visibility: {
      in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
    },
  };

  const whereClause = {
    AND: [
      { parentId },
      {
        OR: [
          { teamId, ...visibilityFilters },
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
                ...visibilityFilters,
              },
              orderBy: {
                createdAt: 'desc',
              },
            }),
            prisma.envelope.count({
              where: {
                type: EnvelopeType.DOCUMENT,
                folderId: folder.id,
              },
            }),
            prisma.envelope.count({
              where: {
                type: EnvelopeType.TEMPLATE,
                folderId: folder.id,
              },
            }),
            prisma.folder.count({
              where: {
                parentId: folder.id,
                teamId,
                ...visibilityFilters,
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
