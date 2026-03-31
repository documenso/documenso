import type { Envelope, EnvelopeItem, Recipient } from '@prisma/client';

import {
  convertPlaceholdersToFieldInputs,
  extractPdfPlaceholders,
} from '@documenso/lib/server-only/pdf/auto-place-fields';
import { findRecipientByPlaceholder } from '@documenso/lib/server-only/pdf/helpers';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prefixedId } from '@documenso/lib/universal/id';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

type UnsafeCreateEnvelopeItemsOptions = {
  files: {
    clientId?: string;
    file: File;
    orderOverride?: number;
  }[];
  envelope: Envelope & {
    envelopeItems: EnvelopeItem[];
    recipients: Recipient[];
  };
  user: {
    id: number;
    name: string | null;
    email: string;
  };
  apiRequestMetadata: ApiRequestMetadata;
};

/**
 * Create envelope items.
 *
 * It is assumed all prior validation has been completed.
 */
export const UNSAFE_createEnvelopeItems = async ({
  files,
  envelope,
  user,
  apiRequestMetadata,
}: UnsafeCreateEnvelopeItemsOptions) => {
  const currentHighestOrderValue =
    envelope.envelopeItems[envelope.envelopeItems.length - 1]?.order ?? 1;

  // For each file: normalize, extract & clean placeholders, then upload.
  const envelopeItemsToCreate = await Promise.all(
    files.map(async ({ file, orderOverride, clientId }, index) => {
      let buffer = Buffer.from(await file.arrayBuffer());

      if (envelope.formValues) {
        buffer = await insertFormValuesInPdf({ pdf: buffer, formValues: envelope.formValues });
      }

      const normalized = await normalizePdf(buffer, {
        flattenForm: envelope.type !== 'TEMPLATE',
      });

      const { cleanedPdf, placeholders } = await extractPdfPlaceholders(normalized);

      const { documentData } = await putPdfFileServerSide({
        name: file.name,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(cleanedPdf),
      });

      return {
        id: prefixedId('envelope_item'),
        title: file.name,
        clientId,
        documentDataId: documentData.id,
        placeholders,
        order: orderOverride ?? currentHighestOrderValue + index + 1,
      };
    }),
  );

  return await prisma.$transaction(async (tx) => {
    const createdItems = await tx.envelopeItem.createManyAndReturn({
      data: envelopeItemsToCreate.map((item) => ({
        id: item.id,
        envelopeId: envelope.id,
        title: item.title,
        documentDataId: item.documentDataId,
        order: item.order,
      })),
      include: {
        documentData: true,
      },
    });

    await tx.documentAuditLog.createMany({
      data: createdItems.map((item) =>
        createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_CREATED,
          envelopeId: envelope.id,
          data: {
            envelopeItemId: item.id,
            envelopeItemTitle: item.title,
          },
          user: {
            name: user.name,
            email: user.email,
          },
          requestMetadata: apiRequestMetadata.requestMetadata,
        }),
      ),
    });

    // Create fields from placeholders if the envelope already has recipients.
    if (envelope.recipients.length > 0) {
      const orderedRecipients = [...envelope.recipients].sort((a, b) => {
        const aOrder = a.signingOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.signingOrder ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return a.id - b.id;
      });

      for (const uploadedItem of envelopeItemsToCreate) {
        if (!uploadedItem.placeholders || uploadedItem.placeholders.length === 0) {
          continue;
        }

        const createdItem = createdItems.find(
          (ci) => ci.documentDataId === uploadedItem.documentDataId,
        );

        if (!createdItem) {
          continue;
        }

        const fieldsToCreate = convertPlaceholdersToFieldInputs(
          uploadedItem.placeholders,
          (recipientPlaceholder, placeholder) =>
            findRecipientByPlaceholder(
              recipientPlaceholder,
              placeholder,
              orderedRecipients,
              orderedRecipients,
            ),
          createdItem.id,
        );

        if (fieldsToCreate.length > 0) {
          await tx.field.createMany({
            data: fieldsToCreate.map((field) => ({
              envelopeId: envelope.id,
              envelopeItemId: createdItem.id,
              recipientId: field.recipientId,
              type: field.type,
              page: field.page,
              positionX: field.positionX,
              positionY: field.positionY,
              width: field.width,
              height: field.height,
              customText: '',
              inserted: false,
              fieldMeta: field.fieldMeta || undefined,
            })),
          });
        }
      }
    }

    return createdItems.map((item) => {
      const clientId = envelopeItemsToCreate.find((file) => file.id === item.id)?.clientId;

      return {
        ...item,
        clientId,
      };
    });
  });
};
