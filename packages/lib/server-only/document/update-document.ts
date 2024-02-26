'use server';

import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type UpdateDocumentOptions = {
  documentId: number;
  data: Prisma.DocumentUpdateInput;
  userId: number;
  teamId?: number;
};

export const updateDocument = async ({
  documentId,
  userId,
  teamId,
  data,
}: UpdateDocumentOptions) => {
  return await prisma.document.update({
    where: {
      id: documentId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    data: {
      ...data,
    },
  });
};
