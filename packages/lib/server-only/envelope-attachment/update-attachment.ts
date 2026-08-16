import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@prisma/client';

import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type UpdateAttachmentOptions = {
  id: string;
  userId: number;
  teamId: number;
  data: { label?: string; data?: string };
};

export const updateAttachment = async ({ id, teamId, userId, data }: UpdateAttachmentOptions) => {
  const attachment = await prisma.envelopeAttachment.findFirst({
    where: {
      id,
    },
    include: {
      envelope: true,
    },
  });

  if (!attachment) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Attachment not found',
    });
  }

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: { type: 'envelopeId', id: attachment.envelopeId },
    userId,
    teamId,
    type: null,
  });

  // Additional validation to check the user has visibility-aware access to the envelope.
  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Attachment not found',
    });
  }

  if (
    attachment.envelope.status === DocumentStatus.COMPLETED ||
    attachment.envelope.status === DocumentStatus.REJECTED
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Attachments can not be modified after the document has been completed or rejected',
    });
  }

  return await prisma.envelopeAttachment.update({
    where: {
      id,
    },
    data,
  });
};
