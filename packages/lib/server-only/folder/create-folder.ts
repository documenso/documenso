import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export interface CreateFolderOptions {
  userId: number;
  teamId?: number;
  name: string;
  parentId?: string | null;
  requestMetadata?: ApiRequestMetadata;
}

export const createFolder = async ({
  userId,
  teamId,
  name,
  parentId = null,
  requestMetadata,
}: CreateFolderOptions) => {
  return await prisma.folder.create({
    data: {
      name,
      userId,
      teamId,
      parentId,
    },
  });
};
