import type { User } from '@prisma/client';
import { FolderType } from '@prisma/client';

import { prisma } from '..';
import type { Prisma } from '../client';

type CreateFolderOptions = {
  type?: string;
  createFolderOptions?: Partial<Prisma.FolderUncheckedCreateInput>;
};

export const seedBlankFolder = async (user: User, options: CreateFolderOptions = {}) => {
  return await prisma.folder.create({
    data: {
      name: 'My folder',
      userId: user.id,
      type: FolderType.DOCUMENT,
      ...options.createFolderOptions,
    },
  });
};
