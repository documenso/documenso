'use server';

<<<<<<< HEAD
import { Prisma } from '@prisma/client';
=======
import type { Prisma } from '@prisma/client';
>>>>>>> main

import { prisma } from '@documenso/prisma';

export type UpdateDocumentOptions = {
  documentId: number;
  data: Prisma.DocumentUpdateInput;
<<<<<<< HEAD
};

export const updateDocument = async ({ documentId, data }: UpdateDocumentOptions) => {
  return await prisma.document.update({
    where: {
      id: documentId,
=======
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
>>>>>>> main
    },
    data: {
      ...data,
    },
  });
};
