import { prisma } from '@documenso/prisma';

export interface FindFoldersOptions {
  userId: number;
  teamId?: number;
  parentId?: string | null;
  page?: number;
  perPage?: number;
}

export const findFolders = async ({
  userId,
  teamId,
  parentId = null,
  page = 1,
  perPage = 10,
}: FindFoldersOptions) => {
  const skip = (page - 1) * perPage;

  // First level folders
  const folders = await prisma.folder.findMany({
    where: {
      userId,
      teamId,
      parentId,
    },
    orderBy: {
      name: 'asc',
    },
    skip,
    take: perPage,
  });

  // Get counts and subfolders for each folder
  const foldersWithDetails = await Promise.all(
    folders.map(async (folder) => {
      const [subfolders, documentCount, subfolderCount] = await Promise.all([
        prisma.folder.findMany({
          where: {
            parentId: folder.id,
            userId,
            teamId,
          },
          orderBy: {
            name: 'asc',
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
          },
        }),
      ]);

      // Add empty subfolders array to each subfolder to match the expected schema
      const subfoldersWithEmptySubfolders = subfolders.map((subfolder) => ({
        ...subfolder,
        subfolders: [],
        _count: {
          documents: 0, // We don't need actual counts for subfolders in the UI
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
    }),
  );

  return foldersWithDetails;
};
