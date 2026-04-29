import { EnvelopeType } from '@prisma/client';
import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { alphaid } from '../../universal/id';
import { unsafeBuildEnvelopeIdQuery } from '../../utils/envelope';

export type CreateSharingIdOptions =
  | {
      documentId: number;
      token: string;
    }
  | {
      documentId: number;
      userId: number;
    }
  | {
      envelopeId: string;
      token: string;
    }
  | {
      envelopeId: string;
      userId: number;
    };

export const createOrGetShareLink = async (options: CreateSharingIdOptions) => {
  const envelope =
    'envelopeId' in options
      ? await prisma.envelope.findUnique({
          where: { id: options.envelopeId },
          select: { id: true, type: true },
        })
      : await prisma.envelope.findUnique({
          where: unsafeBuildEnvelopeIdQuery(
            {
              type: 'documentId',
              id: options.documentId,
            },
            EnvelopeType.DOCUMENT,
          ),
          select: { id: true, type: true },
        });

  if (!envelope || envelope.type !== EnvelopeType.DOCUMENT) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const email = await match(options)
    .with({ token: P.string }, async ({ token }) => {
      return await prisma.recipient
        .findFirst({
          where: {
            envelopeId: envelope.id,
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
          select: {
            email: true,
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
      envelopeId_email: {
        envelopeId: envelope.id,
        email,
      },
    },
    create: {
      email,
      envelopeId: envelope.id,
      slug: alphaid(14),
    },
    update: {},
  });
};
