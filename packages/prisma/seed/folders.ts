import type { User } from '@prisma/client';
import { FolderType } from '@prisma/client';

import { prisma } from '..';
import type { Prisma } from '../client';

type CreateFolderOptions = {
  type?: string;
  createFolderOptions?: Partial<Prisma.FolderUncheckedCreateInput>;
};

export const seedBlankFolder = async (
  user: User,
  teamId: number,
  options: CreateFolderOptions = {},
) => {
  return await prisma.folder.create({
    data: {
      name: 'My folder',
      userId: user.id,
      teamId,
      type: FolderType.DOCUMENT,
      ...options.createFolderOptions,
    },
  });
};
