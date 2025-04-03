import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { DocumentVisibility } from '../../types/document-visibility';

export interface FindFoldersOptions {
  userId: number;
  teamId?: number;
  parentId?: string | null;
}

export const findFolders = async ({ userId, teamId, parentId = null }: FindFoldersOptions) => {
  console.log('findFolders called with:', { userId, teamId, parentId });

  let team = null;
  let teamMemberRole = null;

  if (teamId !== undefined) {
    try {
      team = await prisma.team.findFirstOrThrow({
        where: {
          id: teamId,
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            where: {
              userId,
            },
            select: {
              role: true,
            },
          },
        },
      });

      teamMemberRole = team.members[0].role;
      console.log('Team found:', { teamId, teamMemberRole });
    } catch (error) {
      console.error('Error finding team:', error);
      throw error;
    }
  }

  const visibilityFilters = match(teamMemberRole)
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
    AND: [{ parentId }, teamId ? { teamId, ...visibilityFilters } : { userId, teamId: null }],
  };

  console.log('Where clause:', JSON.stringify(whereClause, null, 2));

  try {
    const folders = await prisma.folder.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('Found folders:', folders.length);

    const foldersWithDetails = await Promise.all(
      folders.map(async (folder) => {
        try {
          const [subfolders, documentCount, subfolderCount] = await Promise.all([
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
              subfolders: 0,
            },
          }));

          return {
            ...folder,
            subfolders: subfoldersWithEmptySubfolders,
            _count: {
              documents: documentCount,
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
