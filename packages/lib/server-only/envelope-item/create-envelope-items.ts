import {
  convertAcroFormFieldsToFieldInputs,
  extractAcroFormFieldsFromPDF,
} from '@documenso/lib/server-only/pdf/acroform-fields';
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
import { logger } from '@documenso/lib/utils/logger';
import { prisma } from '@documenso/prisma';
import type { Envelope, EnvelopeItem, Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';

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
  const currentHighestOrderValue = envelope.envelopeItems[envelope.envelopeItems.length - 1]?.order ?? 1;

  // For each file: extract AcroForm widgets, normalize, extract & clean
  // placeholders, then upload.
  const envelopeItemsToCreate = await Promise.all(
    files.map(async ({ file, orderOverride, clientId }, index) => {
      let buffer = Buffer.from(await file.arrayBuffer());

      if (envelope.formValues) {
        buffer = await insertFormValuesInPdf({ pdf: buffer, formValues: envelope.formValues });
      }

      // Run AcroForm extraction BEFORE normalizePdf — flattening destroys
      // widget geometry, which we need to reuse as Documenso fields.
      const acroFormExtraction = await extractAcroFormFieldsFromPDF(buffer, {
        formValuesProvided: Boolean(envelope.formValues),
      });

      if (acroFormExtraction.skipReason) {
        logger.info(
          {
            event: 'acroform-import.skip',
            envelopeItemTitle: file.name,
            reason: acroFormExtraction.skipReason,
          },
          'AcroForm extraction skipped',
        );
      }

      if (acroFormExtraction.unsupported.length > 0) {
        const byReason: Record<string, number> = {};

        for (const entry of acroFormExtraction.unsupported) {
          byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
        }

        logger.info(
          {
            event: 'acroform-import.unsupported',
            envelopeItemTitle: file.name,
            count: acroFormExtraction.unsupported.length,
            byReason,
          },
          'AcroForm import skipped unsupported widgets',
        );
      }

      if (acroFormExtraction.hasSignedSignature) {
        logger.warn(
          {
            event: 'acroform-import.signed-pdf-no-flatten',
            envelopeItemTitle: file.name,
          },
          'Signed AcroForm signature detected — skipping flatten to preserve signature',
        );
      }

      const shouldFlatten = envelope.type !== 'TEMPLATE' && !acroFormExtraction.hasSignedSignature;

      const normalized = await normalizePdf(buffer, {
        flattenForm: shouldFlatten,
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
        acroFormFields: acroFormExtraction.fields,
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

        const createdItem = createdItems.find((ci) => ci.documentDataId === uploadedItem.documentDataId);

        if (!createdItem) {
          continue;
        }

        const fieldsToCreate = convertPlaceholdersToFieldInputs(
          uploadedItem.placeholders,
          (recipientPlaceholder, placeholder) =>
            findRecipientByPlaceholder(recipientPlaceholder, placeholder, orderedRecipients, orderedRecipients),
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

      const pickFirstSignableRecipient = () => {
        const signable = orderedRecipients.filter(
          (r) => r.role === RecipientRole.SIGNER || r.role === RecipientRole.APPROVER,
        );

        return signable[0] ?? null;
      };

      const firstSignableRecipient = pickFirstSignableRecipient();

      if (firstSignableRecipient) {
        for (const uploadedItem of envelopeItemsToCreate) {
          if (!uploadedItem.acroFormFields || uploadedItem.acroFormFields.length === 0) {
            continue;
          }

          const createdItem = createdItems.find((ci) => ci.documentDataId === uploadedItem.documentDataId);

          if (!createdItem) {
            continue;
          }

          const acroFormFieldsToCreate = convertAcroFormFieldsToFieldInputs(
            uploadedItem.acroFormFields,
            () => firstSignableRecipient,
            createdItem.id,
          );

          if (acroFormFieldsToCreate.length === 0) {
            continue;
          }

          const createdFields = await tx.field.createManyAndReturn({
            data: acroFormFieldsToCreate.map((field) => ({
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

          if (envelope.type === 'DOCUMENT') {
            await tx.documentAuditLog.createMany({
              data: createdFields.map((createdField) =>
                createDocumentAuditLogData({
                  type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
                  envelopeId: envelope.id,
                  metadata: apiRequestMetadata,
                  data: {
                    fieldId: createdField.secondaryId,
                    fieldRecipientEmail: firstSignableRecipient.email,
                    fieldRecipientId: createdField.recipientId,
                    fieldType: createdField.type,
                  },
                }),
              ),
            });
          }
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
