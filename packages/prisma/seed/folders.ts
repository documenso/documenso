import type { User } from '@prisma/client';
import { DocumentStatus, FolderType } from '@prisma/client';

import { prisma } from '..';
import type { Prisma } from '../client';
import { seedDocuments } from './documents';

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

export const seedFolderWithDocuments = async (user: User, options: CreateFolderOptions = {}) => {
  const folder = await seedBlankFolder(user, options);
  await seedDocuments([
    {
      sender: user,
      recipients: [user],
      type: DocumentStatus.DRAFT,
    },
  ]);
};
