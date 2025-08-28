import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { mapEnvelopeToTemplate } from '../../utils/templates';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type GetTemplateByIdOptions = {
  id: number;
  userId: number;
  teamId: number;
};

export const getTemplateById = async ({ id, userId, teamId }: GetTemplateByIdOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'templateId',
      id,
    },
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      directLink: true,
      documentMeta: true,
      documents: {
        select: {
          documentData: true,
        },
      },
      recipients: true,
      fields: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      folder: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  return mapEnvelopeToTemplate(envelope);
};
