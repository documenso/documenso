import { prisma } from '@documenso/prisma';
import type { DocumentData, Envelope, EnvelopeItem, Field, Recipient } from '@prisma/client';
import { EnvelopeType, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';
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
  /**
   * The new flattened DocumentData record. Only set when the item had widgets
   * AND no signed signature (signed-sig items keep their original PDF so the
   * signature stays valid; their other widgets are still imported).
   */
  newDocumentData?: DocumentData;
};

export const UNSAFE_importAcroFormFieldsFromEnvelope = async ({
  envelope,
  apiRequestMetadata,
}: UnsafeImportAcroFormFieldsOptions): Promise<ImportAcroFormFieldsResult> => {
  // 1. Per-item: load PDF, extract widgets, flatten + upload new PDF when needed.
  //    Done outside the transaction — IO and PDF work is slow.
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

      // No fields to import → leave the PDF as-is.
      if (extraction.fields.length === 0) {
        return base;
      }

      // Signed signature → keep widgets in the PDF so the signature stays valid.
      // Other widgets still flow into Documenso fields below.
      if (extraction.hasSignedSignature) {
        return base;
      }

      // Flatten the form, upload as a fresh DocumentData. The old record is
      // deleted after the transaction commits.
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

  // 2. Transaction: resolve recipient, swap documentData, create fields,
  //    write audit logs.
  const { createdFields, importedItemsCount } = await prisma.$transaction(async (tx) => {
    const pickFirstSignableRecipient = (recipients: Pick<Recipient, 'id' | 'email' | 'role' | 'signingOrder'>[]) => {
      const signable = recipients.filter((r) => r.role === RecipientRole.SIGNER || r.role === RecipientRole.APPROVER);

      if (signable.length === 0) {
        return null;
      }

      return [...signable].sort((a, b) => {
        const aOrder = a.signingOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.signingOrder ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return a.id - b.id;
      })[0];
    };

    let availableRecipients = await tx.recipient.findMany({
      where: { envelopeId: envelope.id },
      select: { id: true, email: true, role: true, signingOrder: true },
    });

    let firstSignableRecipient = pickFirstSignableRecipient(availableRecipients);

    if (!firstSignableRecipient) {
      // Mirror the placeholder branch in createEnvelope: create Recipient 1 as
      // a SIGNER so the imported fields have somewhere to land. The user can
      // reassign in the editor afterwards.
      const placeholderEmail = 'recipient.1@documenso.com';

      await tx.recipient.create({
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
      });

      // eslint-disable-next-line require-atomic-updates
      availableRecipients = await tx.recipient.findMany({
        where: { envelopeId: envelope.id },
        select: { id: true, email: true, role: true, signingOrder: true },
      });

      firstSignableRecipient = pickFirstSignableRecipient(availableRecipients);
    }

    if (!firstSignableRecipient) {
      // Should be unreachable — we just created one.
      throw new Error('Failed to resolve a signable recipient for AcroForm import');
    }

    const recipient = firstSignableRecipient;

    const createdFields: Field[] = [];
    let importedItemsCount = 0;

    for (const item of prepared) {
      if (item.extraction.fields.length === 0) {
        continue;
      }

      // Swap to the flattened PDF when we produced one.
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

  // 3. Delete orphaned old DocumentData records. Outside the transaction so a
  //    delete failure does not undo the import.
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
