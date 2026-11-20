import { prisma } from '@documenso/prisma';
import type { DocumentData, Envelope, EnvelopeItem, Recipient } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putNormalizedPdfFileServerSide } from '../../universal/upload/put-file.server';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { assertEnvelopeMutable } from '../envelope/assert-envelope-mutable';
import { extractAcroFormFields } from '../pdf/acroform-fields';

type UnsafeImportAcroFormFieldsOptions = {
  envelope: Pick<Envelope, 'id'>;
  envelopeItem: Pick<EnvelopeItem, 'id' | 'title' | 'documentDataId'> & {
    documentData: DocumentData;
  };

  /**
   * The recipient that gets the imported fields.
   */
  recipient: Pick<Recipient, 'id' | 'email'>;
  apiRequestMetadata: ApiRequestMetadata;
};

/**
 * Convert the form fields in the PDF of a document envelope item to Documenso fields.
 *
 * It is assumed all prior validation has been completed.
 */
export const UNSAFE_importAcroFormFields = async ({
  envelope,
  envelopeItem,
  recipient,
  apiRequestMetadata,
}: UnsafeImportAcroFormFieldsOptions) => {
  const pdf = await getFileServerSide(envelopeItem.documentData);

  const { cleanedPdf, fields } = await extractAcroFormFields(Buffer.from(pdf));

  if (fields.length === 0) {
    return [];
  }

  // This flattens the form fields that stay in the PDF.
  const { documentData: newDocumentData } = await putNormalizedPdfFileServerSide({
    name: envelopeItem.title,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(cleanedPdf),
  });

  const createdFields = await prisma.$transaction(async (tx) => {
    await assertEnvelopeMutable(envelope, tx);

    await tx.envelopeItem.update({
      where: {
        id: envelopeItem.id,
        envelopeId: envelope.id,
      },
      data: {
        documentDataId: newDocumentData.id,
      },
    });

    const createdFields = await tx.field.createManyAndReturn({
      data: fields.map((field) => ({
        ...field,
        envelopeId: envelope.id,
        envelopeItemId: envelopeItem.id,
        recipientId: recipient.id,
        customText: '',
        inserted: false,
      })),
    });

    await tx.documentAuditLog.createMany({
      data: createdFields.map((field) =>
        createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
          envelopeId: envelope.id,
          metadata: apiRequestMetadata,
          data: {
            fieldId: field.secondaryId,
            fieldRecipientEmail: recipient.email,
            fieldRecipientId: recipient.id,
            fieldType: field.type,
          },
        }),
      ),
    });

    return createdFields;
  });

  await prisma.documentData.delete({
    where: {
      id: envelopeItem.documentDataId,
    },
  });

  return createdFields;
};
