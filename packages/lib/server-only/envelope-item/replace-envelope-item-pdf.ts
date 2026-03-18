import type { Envelope, Field, Recipient } from '@prisma/client';

import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { convertPlaceholdersToFieldInputs, extractPdfPlaceholders } from '../pdf/auto-place-fields';
import { findRecipientByPlaceholder } from '../pdf/helpers';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';

type UnsafeReplaceEnvelopeItemPdfOptions = {
  envelope: Pick<Envelope, 'id' | 'type' | 'formValues'>;

  /**
   * Recipients used to resolve placeholder field assignments.
   * When provided and placeholders are found in the replacement PDF,
   * fields will be auto-created for matching recipients.
   */
  recipients: Recipient[];

  /**
   * The ID of the envelope item which we will be replacing the PDF for.
   */
  envelopeItemId: string;

  /**
   * The ID of the old document data we will be deleting.
   */
  oldDocumentDataId: string;

  /**
   * The data we will be replacing.
   */
  data: {
    title?: string;
    order?: number;
    file: File;
  };

  user: {
    id: number;
    name: string | null;
    email: string;
  };
  apiRequestMetadata: ApiRequestMetadata;
};

type UnsafeReplaceEnvelopeItemPdfResult = {
  updatedItem: {
    id: string;
    title: string;
    envelopeId: string;
    order: number;
    documentDataId: string;
  };

  /**
   * The full list of fields for the envelope after the replacement.
   *
   * Only returned when fields were created or deleted during the replacement,
   * otherwise `undefined`.
   */
  fields: Field[] | undefined;
};

export const UNSAFE_replaceEnvelopeItemPdf = async ({
  envelope,
  recipients,
  envelopeItemId,
  oldDocumentDataId,
  data,
  user,
  apiRequestMetadata,
}: UnsafeReplaceEnvelopeItemPdfOptions): Promise<UnsafeReplaceEnvelopeItemPdfResult> => {
  let buffer = Buffer.from(await data.file.arrayBuffer());

  if (envelope.formValues) {
    buffer = await insertFormValuesInPdf({ pdf: buffer, formValues: envelope.formValues });
  }

  const normalized = await normalizePdf(buffer, {
    flattenForm: envelope.type !== 'TEMPLATE',
  });

  const { cleanedPdf, placeholders } = await extractPdfPlaceholders(normalized);

  // Upload the new PDF and get a new DocumentData record.
  const { documentData: newDocumentData, filePageCount } = await putPdfFileServerSide({
    name: data.file.name,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(cleanedPdf),
  });

  let didFieldsChange = false;

  const updatedEnvelopeItem = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.envelopeItem.update({
      where: {
        id: envelopeItemId,
        envelopeId: envelope.id,
      },
      data: {
        documentDataId: newDocumentData.id,
        title: data.title,
        order: data.order,
      },
    });

    // Todo: Audit log if we're updating the title or order.

    // Delete fields that reference pages beyond the new PDF's page count.
    const outOfBoundsFields = await tx.field.findMany({
      where: {
        envelopeId: envelope.id,
        envelopeItemId,
        page: {
          gt: filePageCount,
        },
      },
      select: {
        id: true,
      },
    });

    const deletedFieldIds = outOfBoundsFields.map((f) => f.id);

    if (deletedFieldIds.length > 0) {
      await tx.field.deleteMany({
        where: {
          id: {
            in: deletedFieldIds,
          },
        },
      });

      didFieldsChange = true;
    }

    if (recipients.length > 0 && placeholders.length > 0) {
      const orderedRecipients = [...recipients].sort((a, b) => {
        const aOrder = a.signingOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.signingOrder ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return a.id - b.id;
      });

      const fieldsToCreate = convertPlaceholdersToFieldInputs(
        placeholders,
        (recipientPlaceholder, placeholder) =>
          findRecipientByPlaceholder(
            recipientPlaceholder,
            placeholder,
            orderedRecipients,
            orderedRecipients,
          ),
        updatedItem.id,
      );

      if (fieldsToCreate.length > 0) {
        await tx.field.createMany({
          data: fieldsToCreate.map((field) => ({
            envelopeId: envelope.id,
            envelopeItemId: updatedItem.id,
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

        didFieldsChange = true;
      }
    }

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.ENVELOPE_ITEM_PDF_REPLACED,
        envelopeId: envelope.id,
        data: {
          envelopeItemId: updatedItem.id,
          envelopeItemTitle: updatedItem.title,
        },
        user: {
          name: user.name,
          email: user.email,
        },
        requestMetadata: apiRequestMetadata.requestMetadata,
      }),
    });

    return updatedItem;
  });

  // Delete the old DocumentData (now orphaned).
  await prisma.documentData.delete({
    where: {
      id: oldDocumentDataId,
    },
  });

  let fields: Field[] | undefined = undefined;

  if (didFieldsChange) {
    try {
      fields = await prisma.field.findMany({
        where: {
          envelopeId: envelope.id,
        },
      });
    } catch (err) {
      // Do nothing.
      console.error(err);
    }
  }

  return {
    updatedItem: updatedEnvelopeItem,
    fields,
  };
};
