import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { DocumentVisibility } from '../../types/document-visibility';
import type { TFolderType } from '../../types/folder-type';
import { getTeamById } from '../team/get-team';

export interface FindFoldersOptions {
  userId: number;
  teamId: number;
  parentId?: string | null;
  type?: TFolderType;
}

export const findFolders = async ({ userId, teamId, parentId, type }: FindFoldersOptions) => {
  const team = await getTeamById({ userId, teamId });

  const visibilityFilters = match(team.currentTeamRole)
    .with(TeamMemberRole.ADMIN, () => ({
      visibility: {
        in: [
          DocumentVisibility.EVERYONE,
          DocumentVisibility.MANAGER_AND_ABOVE,
          DocumentVisibility.ADMIN,
        ],
      },
    }))
    .with(TeamMemberRole.MANAGER, () => ({
      visibility: {
        in: [DocumentVisibility.EVERYONE, DocumentVisibility.MANAGER_AND_ABOVE],
      },
    }))
    .otherwise(() => ({ visibility: DocumentVisibility.EVERYONE }));

  const whereClause = {
    AND: [
      { parentId },
      teamId
        ? {
            OR: [
              { teamId, ...visibilityFilters },
              { userId, teamId },
            ],
          }
        : { userId, teamId: null },
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
                ...(teamId ? { teamId, ...visibilityFilters } : { userId, teamId: null }),
              },
              orderBy: {
                createdAt: 'desc',
              },
            }),
            prisma.document.count({
              where: {
                folderId: folder.id,
              },
            }),
            prisma.template.count({
              where: {
                folderId: folder.id,
              },
            }),
            prisma.folder.count({
              where: {
                parentId: folder.id,
                ...(teamId ? { teamId, ...visibilityFilters } : { userId, teamId: null }),
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
