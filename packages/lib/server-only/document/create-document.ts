'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentOptions = {
  title: string;
  userId: number;
  teamId?: number;
  documentDataId: string;
};

export const createDocument = async ({
  userId,
  title,
  documentDataId,
  teamId,
}: CreateDocumentOptions) => {
  return await prisma.$transaction(async (tx) => {
    if (teamId !== undefined) {
      await tx.team.findFirstOrThrow({
        where: {
          id: teamId,
          members: {
            some: {
              userId,
            },
          },
        },
      });
    }

    return await tx.document.create({
      data: {
        title,
        documentDataId,
        userId,
        teamId,
      },
    });
  });
};
