import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { mapSecondaryIdToTemplateId } from '../../utils/envelope';

export interface GetTemplateByDirectLinkTokenOptions {
  token: string;
}

export const getTemplateByDirectLinkToken = async ({
  token,
}: GetTemplateByDirectLinkTokenOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      type: EnvelopeType.TEMPLATE,
      directLink: {
        token,
        enabled: true,
      },
    },
    include: {
      directLink: true,
      recipients: {
        include: {
          fields: true,
        },
      },
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
      documentMeta: true,
    },
  });

  const directLink = envelope?.directLink;

  const firstDocumentData = envelope?.envelopeItems[0]?.documentData;

  // Doing this to enforce type safety for directLink.
  if (!directLink || !firstDocumentData) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const recipientsWithMappedFields = envelope.recipients.map((recipient) => ({
    ...recipient,
    templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
    documentId: null,
    fields: recipient.fields.map((field) => ({
      ...field,
      templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
      documentId: null,
    })),
  }));

  // Backwards compatibility mapping.
  return {
    id: mapSecondaryIdToTemplateId(envelope.secondaryId),
    envelopeId: envelope.id,
    type: envelope.templateType,
    visibility: envelope.visibility,
    externalId: envelope.externalId,
    title: envelope.title,
    userId: envelope.userId,
    teamId: envelope.teamId,
    authOptions: envelope.authOptions,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    publicTitle: envelope.publicTitle,
    publicDescription: envelope.publicDescription,
    folderId: envelope.folderId,
    templateDocumentDataId: firstDocumentData.id,
    templateDocumentData: {
      ...firstDocumentData,
      envelopeItemId: envelope.envelopeItems[0].id,
    },
    directLink: {
      ...directLink,
      templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
    },
    templateMeta: {
      ...envelope.documentMeta,
      templateId: mapSecondaryIdToTemplateId(envelope.secondaryId),
    },
    recipients: recipientsWithMappedFields,
    fields: recipientsWithMappedFields.flatMap((recipient) => recipient.fields),
    envelopeItems: envelope.envelopeItems.map((item) => ({
      id: item.id,
      envelopeId: item.envelopeId,
    })),
  };
};
