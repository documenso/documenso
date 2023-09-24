import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { alphaid } from '../../universal/id';

export type CreateSharingIdOptions =
  | {
      documentId: number;
      token: string;
    }
  | {
      documentId: number;
      userId: number;
    };

export const createOrGetShareLink = async ({ documentId, ...options }: CreateSharingIdOptions) => {
  const email = await match(options)
    .with({ token: P.string }, async ({ token }) => {
      return await prisma.recipient
        .findFirst({
          where: {
            documentId,
            token,
          },
        })
        .then((recipient) => recipient?.email);
    })
    .with({ userId: P.number }, async ({ userId }) => {
      return await prisma.user
        .findFirst({
          where: {
            id: userId,
          },
        })
        .then((user) => user?.email);
    })
    .exhaustive();

  if (!email) {
    throw new Error('Unable to create share link for document with the given email');
  }

  return await prisma.documentShareLink.upsert({
    where: {
      documentId_email: {
        email,
        documentId,
      },
    },
    create: {
      email,
      documentId,
      slug: alphaid(14),
    },
    update: {},
  });
};
