import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@prisma/client';

import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type CreateAttachmentOptions = {
  envelopeId: string;
  teamId: number;
  userId: number;
  data: {
    label: string;
    data: string;
  };
};

export const createAttachment = async ({ envelopeId, teamId, userId, data }: CreateAttachmentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: { type: 'envelopeId', id: envelopeId },
    userId,
    teamId,
    type: null,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (envelope.status === DocumentStatus.COMPLETED || envelope.status === DocumentStatus.REJECTED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Attachments can not be modified after the document has been completed or rejected',
    });
  }

  return await prisma.envelopeAttachment.create({
    data: {
      envelopeId,
      type: 'link',
      ...data,
    },
  });
};
