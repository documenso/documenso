import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type GetDocumentByIdOptions = {
  documentId: number;
  userId: number;
  teamId: number;
};

export const getDocumentById = async ({ documentId, userId, teamId }: GetDocumentByIdOptions) => {
  const { documentWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'documentId',
      id: documentId,
    },
    validatedUserId: userId,
    unvalidatedTeamId: teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: documentWhereInput,
    include: {
      documents: {
        include: {
          documentData: true,
        },
      },
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: {
        select: {
          email: true,
        },
      },
      team: {
        select: {
          id: true,
          url: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document could not be found',
    });
  }

  return document;
};
