import { DocumentSource, EnvelopeType } from '@prisma/client';
import { omit } from 'remeda';

import { nanoid, prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { incrementTemplateId } from '../envelope/increment-id';

export type DuplicateTemplateOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
};

export const duplicateTemplate = async ({ id, userId, teamId }: DuplicateTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      recipients: {
        select: {
          email: true,
          name: true,
          role: true,
          signingOrder: true,
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

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const { formattedTemplateId } = await incrementTemplateId();

  const createdDocumentMeta = await prisma.documentMeta.create({
    data: {
      ...omit(envelope.documentMeta, ['id']),
      emailSettings: envelope.documentMeta.emailSettings || undefined,
    },
  });

  const duplicatedEnvelope = await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: formattedTemplateId,
      type: EnvelopeType.TEMPLATE,
      userId,
      teamId,
      title: envelope.title + ' (copy)',
      documentMetaId: createdDocumentMeta.id,
      authOptions: envelope.authOptions || undefined,
      visibility: envelope.visibility,
      source: DocumentSource.DOCUMENT, // Todo: Migration what to use here.
    },
    include: {
      recipients: true,
    },
  });

  // Key = original envelope item ID
  // Value = duplicated envelope item ID.
  const oldEnvelopeItemToNewEnvelopeItemIdMap: Record<string, string> = {};

  // Duplicate the envelope items.
  await Promise.all(
    envelope.envelopeItems.map(async (envelopeItem) => {
      const duplicatedDocumentData = await prisma.documentData.create({
        data: {
          type: envelopeItem.documentData.type,
          data: envelopeItem.documentData.initialData,
          initialData: envelopeItem.documentData.initialData,
        },
      });

      const duplicatedEnvelopeItem = await prisma.envelopeItem.create({
        data: {
          id: prefixedId('envelope_item'),
          title: envelopeItem.title,
          envelopeId: duplicatedEnvelope.id,
          documentDataId: duplicatedDocumentData.id,
        },
      });

      oldEnvelopeItemToNewEnvelopeItemIdMap[envelopeItem.id] = duplicatedEnvelopeItem.id;
    }),
  );

  for (const recipient of envelope.recipients) {
    await prisma.recipient.create({
      data: {
        envelopeId: duplicatedEnvelope.id,
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        token: nanoid(),
        fields: {
          createMany: {
            data: recipient.fields.map((field) => ({
              envelopeId: duplicatedEnvelope.id,
              envelopeItemId: oldEnvelopeItemToNewEnvelopeItemIdMap[field.envelopeItemId],
              type: field.type,
              page: field.page,
              positionX: field.positionX,
              positionY: field.positionY,
              width: field.width,
              height: field.height,
              customText: '',
              inserted: false,
              fieldMeta: field.fieldMeta as PrismaJson.FieldMeta,
            })),
          },
        },
      },
    });
  }

  return duplicatedEnvelope;
};
