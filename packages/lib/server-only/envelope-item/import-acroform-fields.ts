import { prisma } from '@documenso/prisma';
import type { DocumentData, Envelope, EnvelopeItem, Field, Recipient } from '@prisma/client';
import { EnvelopeType, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { nanoid } from '../../universal/id';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { logger } from '../../utils/logger';
import {
  type AcroFormExtractionResult,
  type AcroFormSkipReason,
  convertAcroFormFieldsToFieldInputs,
  extractAcroFormFieldsFromPDF,
} from '../pdf/acroform-fields';
import { normalizePdf } from '../pdf/normalize-pdf';

type UnsafeImportAcroFormFieldsOptions = {
  envelope: Pick<Envelope, 'id' | 'type' | 'formValues'> & {
    envelopeItems: (Pick<EnvelopeItem, 'id' | 'title' | 'documentDataId'> & {
      documentData: DocumentData;
    })[];
    recipients: Recipient[];
  };
  apiRequestMetadata: ApiRequestMetadata;
};

type PerItemSkip = {
  envelopeItemId: string;
  envelopeItemTitle: string;
  reason: AcroFormSkipReason;
};

export type ImportAcroFormFieldsResult = {
  itemsProcessed: number;
  fieldsCreated: number;
  unsupportedCount: number;
  signedSignatureCount: number;
  skippedItems: PerItemSkip[];
  fields: Field[];
};

type PreparedItem = {
  envelopeItemId: string;
  envelopeItemTitle: string;
  oldDocumentDataId: string;
  extraction: AcroFormExtractionResult;
  newDocumentData?: DocumentData;
};

export const UNSAFE_importAcroFormFieldsFromEnvelope = async ({
  envelope,
  apiRequestMetadata,
}: UnsafeImportAcroFormFieldsOptions): Promise<ImportAcroFormFieldsResult> => {
  if (envelope.type !== EnvelopeType.DOCUMENT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'AcroForm import is only supported for document envelopes',
    });
  }

  const prepared: PreparedItem[] = await Promise.all(
    envelope.envelopeItems.map(async (item): Promise<PreparedItem> => {
      const buffer = await getFileServerSide(item.documentData);

      const extraction = await extractAcroFormFieldsFromPDF(Buffer.from(buffer), {
        formValuesProvided: Boolean(envelope.formValues),
      });

      if (extraction.skipReason) {
        logger.info(
          {
            event: 'acroform-import.skip',
            envelopeItemId: item.id,
            envelopeItemTitle: item.title,
            reason: extraction.skipReason,
          },
          'AcroForm extraction skipped',
        );
      }

      if (extraction.unsupported.length > 0) {
        const byReason: Record<string, number> = {};

        for (const entry of extraction.unsupported) {
          byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
        }

        logger.info(
          {
            event: 'acroform-import.unsupported',
            envelopeItemId: item.id,
            envelopeItemTitle: item.title,
            count: extraction.unsupported.length,
            byReason,
          },
          'AcroForm import skipped unsupported widgets',
        );
      }

      if (extraction.hasSignedSignature) {
        logger.warn(
          {
            event: 'acroform-import.signed-pdf-no-flatten',
            envelopeItemId: item.id,
            envelopeItemTitle: item.title,
          },
          'Signed AcroForm signature detected — skipping flatten to preserve signature',
        );
      }

      const base: PreparedItem = {
        envelopeItemId: item.id,
        envelopeItemTitle: item.title,
        oldDocumentDataId: item.documentDataId,
        extraction,
      };

      if (extraction.fields.length === 0 || extraction.hasSignedSignature) {
        return base;
      }

      const flattened = await normalizePdf(Buffer.from(buffer), {
        flattenForm: true,
      });

      const { documentData: newDocumentData } = await putPdfFileServerSide({
        name: item.title,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(flattened),
      });

      return {
        ...base,
        newDocumentData,
      };
    }),
  );

  const totalFieldsToCreate = prepared.reduce((sum, p) => sum + p.extraction.fields.length, 0);
  const unsupportedCount = prepared.reduce((sum, p) => sum + p.extraction.unsupported.length, 0);
  const signedSignatureCount = prepared.filter((p) => p.extraction.hasSignedSignature).length;

  const skippedItems: PerItemSkip[] = [];

  for (const p of prepared) {
    const reason = p.extraction.skipReason;

    if (!reason) {
      continue;
    }

    skippedItems.push({
      envelopeItemId: p.envelopeItemId,
      envelopeItemTitle: p.envelopeItemTitle,
      reason,
    });
  }

  if (totalFieldsToCreate === 0) {
    return {
      itemsProcessed: 0,
      fieldsCreated: 0,
      unsupportedCount,
      signedSignatureCount,
      skippedItems,
      fields: [],
    };
  }

  const { createdFields, importedItemsCount } = await prisma.$transaction(async (tx) => {
    const pickFirstSignableRecipient = (recipients: Pick<Recipient, 'id' | 'email' | 'role' | 'signingOrder'>[]) => {
      const signable = recipients.filter((r) => r.role === RecipientRole.SIGNER || r.role === RecipientRole.APPROVER);

      if (signable.length === 0) {
        return null;
      }

      return signable.sort((a, b) => {
        const aOrder = a.signingOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.signingOrder ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return a.id - b.id;
      })[0];
    };

    const signedItemIds = prepared
      .filter((item) => item.extraction.hasSignedSignature && item.extraction.fields.length > 0)
      .map((item) => item.envelopeItemId);

    const alreadyImportedSignedItemIds = new Set<string>();

    if (signedItemIds.length > 0) {
      const existingImportedFields = await tx.field.findMany({
        where: {
          envelopeId: envelope.id,
          envelopeItemId: {
            in: signedItemIds,
          },
        },
        select: {
          envelopeItemId: true,
          fieldMeta: true,
        },
      });

      for (const field of existingImportedFields) {
        const fieldMeta = field.fieldMeta;

        if (
          fieldMeta &&
          typeof fieldMeta === 'object' &&
          !Array.isArray(fieldMeta) &&
          (fieldMeta as { source?: unknown }).source === 'acroform'
        ) {
          alreadyImportedSignedItemIds.add(field.envelopeItemId);
        }
      }
    }

    const itemsToImport = prepared.filter((item) => {
      if (item.extraction.fields.length === 0) {
        return false;
      }

      return !(item.extraction.hasSignedSignature && alreadyImportedSignedItemIds.has(item.envelopeItemId));
    });

    const createdFields: Field[] = [];

    if (itemsToImport.length === 0) {
      return { createdFields, importedItemsCount: 0 };
    }

    let recipient = pickFirstSignableRecipient(
      await tx.recipient.findMany({
        where: { envelopeId: envelope.id },
        select: { id: true, email: true, role: true, signingOrder: true },
      }),
    );

    if (!recipient) {
      const placeholderEmail = 'recipient.1@documenso.com';

      recipient = await tx.recipient.create({
        data: {
          envelopeId: envelope.id,
          email: placeholderEmail,
          name: 'Recipient 1',
          role: RecipientRole.SIGNER,
          signingOrder: 1,
          token: nanoid(),
          sendStatus: SendStatus.NOT_SENT,
          signingStatus: SigningStatus.NOT_SIGNED,
        },
        select: { id: true, email: true, role: true, signingOrder: true },
      });
    }

    let importedItemsCount = 0;

    for (const item of itemsToImport) {
      if (item.newDocumentData) {
        await tx.envelopeItem.update({
          where: { id: item.envelopeItemId },
          data: { documentDataId: item.newDocumentData.id },
        });
      }

      const fieldsToCreate = convertAcroFormFieldsToFieldInputs(
        item.extraction.fields,
        () => recipient,
        item.envelopeItemId,
      );

      const itemCreatedFields = await tx.field.createManyAndReturn({
        data: fieldsToCreate.map((field) => ({
          envelopeId: envelope.id,
          envelopeItemId: item.envelopeItemId,
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

      createdFields.push(...itemCreatedFields);
      importedItemsCount += 1;

      if (envelope.type === EnvelopeType.DOCUMENT) {
        await tx.documentAuditLog.createMany({
          data: itemCreatedFields.map((createdField) =>
            createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
              envelopeId: envelope.id,
              metadata: apiRequestMetadata,
              data: {
                fieldId: createdField.secondaryId,
                fieldRecipientEmail: recipient.email,
                fieldRecipientId: createdField.recipientId,
                fieldType: createdField.type,
              },
            }),
          ),
        });
      }
    }

    return { createdFields, importedItemsCount };
  });

  await Promise.all(
    prepared
      .filter((p) => p.newDocumentData !== undefined)
      .map((p) =>
        prisma.documentData.delete({ where: { id: p.oldDocumentDataId } }).catch((err) => {
          logger.error(
            {
              event: 'acroform-import.delete-old-document-data-failed',
              envelopeItemId: p.envelopeItemId,
              oldDocumentDataId: p.oldDocumentDataId,
              err,
            },
            'Failed to delete orphaned DocumentData after AcroForm import',
          );
        }),
      ),
  );

  return {
    itemsProcessed: importedItemsCount,
    fieldsCreated: createdFields.length,
    unsupportedCount,
    signedSignatureCount,
    skippedItems,
    fields: createdFields,
  };
};
