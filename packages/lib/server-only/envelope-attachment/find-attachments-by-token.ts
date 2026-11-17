import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export type FindAttachmentsByTokenOptions = {
  envelopeId: string;
  token: string;
};

export const findAttachmentsByToken = async ({ envelopeId, token }: FindAttachmentsByTokenOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      recipients: {
        some: {
          token,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  return await prisma.envelopeAttachment.findMany({
    where: {
      envelopeId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
};
