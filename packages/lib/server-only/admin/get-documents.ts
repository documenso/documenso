import { prisma } from '@documenso/prisma';

export const getDocsCount = async () => {
  return await prisma.document.count();
};
