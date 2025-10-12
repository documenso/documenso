import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { mapSecondaryIdToTemplateId } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type ToggleTemplateDirectLinkOptions = {
  templateId: number;
  userId: number;
  teamId: number;
  enabled: boolean;
};

export const toggleTemplateDirectLink = async ({
  templateId,
  userId,
  teamId,
  enabled,
}: ToggleTemplateDirectLinkOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    type: EnvelopeType.TEMPLATE,
    id: {
      type: 'templateId',
      id: templateId,
    },
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      directLink: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const { directLink } = envelope;

  if (!directLink) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Direct template link not found',
    });
  }

  const updatedDirectLink = await prisma.templateDirectLink.update({
    where: {
      id: directLink.id,
    },
    data: {
      envelopeId: envelope.id,
      enabled,
    },
  });

  return {
    id: updatedDirectLink.id,
    token: updatedDirectLink.token,
    createdAt: updatedDirectLink.createdAt,
    enabled: updatedDirectLink.enabled,
    directTemplateRecipientId: updatedDirectLink.directTemplateRecipientId,
    templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
    envelopeId: envelope.id,
  };
};
