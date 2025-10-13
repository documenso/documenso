import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapSecondaryIdToTemplateId } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type GetTemplateByIdOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
};

export const getTemplateById = async ({ id, userId, teamId }: GetTemplateByIdOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      directLink: true,
      documentMeta: true,
      envelopeItems: {
        select: {
          id: true,
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

  const firstTemplateDocumentData = envelope.envelopeItems[0].documentData;

  if (!firstTemplateDocumentData) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template document data not found',
    });
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  const { envelopeItems, documentMeta, ...rest } = envelope;

  const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);

  return {
    ...rest,
    envelopeId: envelope.id,
    type: envelope.templateType,
    templateDocumentData: {
      ...firstTemplateDocumentData,
      envelopeItemId: envelope.envelopeItems[0].id,
    },
    templateMeta: envelope.documentMeta,
    fields: envelope.fields.map((field) => ({
      ...field,
      templateId: legacyTemplateId,
    })),
    directLink: envelope.directLink
      ? {
          ...envelope.directLink,
          templateId: legacyTemplateId,
        }
      : null,
    id: mapSecondaryIdToTemplateId(envelope.secondaryId),
  };
};
