import { EnvelopeType } from '@prisma/client';

import { generateAvaliableRecipientPlaceholder } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type DeleteTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  teamId: number;
};

export const deleteTemplateDirectLink = async ({
  templateId,
  userId,
  teamId,
}: DeleteTemplateDirectLinkOptions): Promise<void> => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'templateId',
      id: templateId,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      directLink: true,
      recipients: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const { directLink } = envelope;

  if (!directLink) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: {
        envelopeId: envelope.id,
        id: directLink.directTemplateRecipientId,
      },
      data: {
        ...generateAvaliableRecipientPlaceholder(envelope.recipients),
      },
    });

    await tx.templateDirectLink.delete({
      where: {
        envelopeId: envelope.id,
      },
    });
  });
};
