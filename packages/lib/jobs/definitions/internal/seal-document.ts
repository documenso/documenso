import { nanoid } from 'nanoid';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';

import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  RecipientRole,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';
import { signPdf } from '@documenso/signing';

import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import PostHogServerClient from '../../../server-only/feature-flags/get-post-hog-server-client';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { flattenAnnotations } from '../../../server-only/pdf/flatten-annotations';
import { flattenForm } from '../../../server-only/pdf/flatten-form';
import { insertFieldInPDF } from '../../../server-only/pdf/insert-field-in-pdf';
import { normalizeSignatureAppearances } from '../../../server-only/pdf/normalize-signature-appearances';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { getFile } from '../../../universal/upload/get-file';
import { putPdfFile } from '../../../universal/upload/put-file';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { type JobDefinition } from '../../client/_internal/job';

const SEAL_DOCUMENT_JOB_DEFINITION_ID = 'internal.seal-document';

const SEAL_DOCUMENT_JOB_DEFINITION_SCHEMA = z.object({
  documentId: z.number(),
  sendEmail: z.boolean().optional(),
  isResealing: z.boolean().optional(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export const SEAL_DOCUMENT_JOB_DEFINITION = {
  id: SEAL_DOCUMENT_JOB_DEFINITION_ID,
  name: 'Seal Document',
  version: '1.0.0',
  trigger: {
    name: SEAL_DOCUMENT_JOB_DEFINITION_ID,
    schema: SEAL_DOCUMENT_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const { documentId, sendEmail = true, isResealing = false, requestMetadata } = payload;

    const document = await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
        Recipient: {
          every: {
            signingStatus: SigningStatus.SIGNED,
          },
        },
      },
      include: {
        documentData: true,
        Recipient: true,
      },
    });

    // Seems silly but we need to do this in case the job is re-ran
    // after it has already run through the update task further below.
    // eslint-disable-next-line @typescript-eslint/require-await
    const documentStatus = await io.runTask('get-document-status', async () => {
      return document.status;
    });

    const { documentData } = document;

    if (!documentData) {
      throw new Error(`Document ${document.id} has no document data`);
    }

    const recipients = await prisma.recipient.findMany({
      where: {
        documentId: document.id,
        role: {
          not: RecipientRole.CC,
        },
      },
    });

    if (recipients.some((recipient) => recipient.signingStatus !== SigningStatus.SIGNED)) {
      throw new Error(`Document ${document.id} has unsigned recipients`);
    }

    const fields = await prisma.field.findMany({
      where: {
        documentId: document.id,
      },
      include: {
        Signature: true,
      },
    });

    if (fields.some((field) => !field.inserted)) {
      throw new Error(`Document ${document.id} has unsigned fields`);
    }

    if (isResealing) {
      // If we're resealing we want to use the initial data for the document
      // so we aren't placing fields on top of eachother.
      documentData.data = documentData.initialData;
    }

    const pdfData = await io.runTask('get-document-data', async () => {
      const data = await getFile(documentData);

      return Buffer.from(data).toString('base64');
    });

    const certificateData = await io.runTask('get-certificate-data', async () => {
      const data = await getCertificatePdf({ documentId }).catch(() => null);

      if (!data) {
        return null;
      }

      return Buffer.from(data).toString('base64');
    });

    const pdfBuffer = await io.runTask('decorate-and-sign-pdf', async () => {
      const pdfDoc = await PDFDocument.load(Buffer.from(pdfData, 'base64'));

      // Normalize and flatten layers that could cause issues with the signature
      normalizeSignatureAppearances(pdfDoc);
      flattenForm(pdfDoc);
      flattenAnnotations(pdfDoc);

      if (certificateData) {
        const certificateDoc = await PDFDocument.load(Buffer.from(certificateData, 'base64'));

        const certificatePages = await pdfDoc.copyPages(
          certificateDoc,
          certificateDoc.getPageIndices(),
        );

        certificatePages.forEach((page) => {
          pdfDoc.addPage(page);
        });
      }

      for (const field of fields) {
        await insertFieldInPDF(pdfDoc, field);
      }

      // Re-flatten the form to handle our checkbox and radio fields that
      // create native arcoFields
      flattenForm(pdfDoc);

      const pdfBytes = await pdfDoc.save();

      const buffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

      return buffer.toString('base64');
    });

    const newData = await io.runTask('store-signed-document', async () => {
      const { name, ext } = path.parse(document.title);

      const { data } = await putPdfFile({
        name: `${name}_signed${ext}`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(Buffer.from(pdfBuffer, 'base64')),
      });

      return data;
    });

    const postHog = PostHogServerClient();

    if (postHog) {
      postHog.capture({
        distinctId: nanoid(),
        event: 'App: Document Sealed',
        properties: {
          documentId: document.id,
        },
      });
    }

    await io.runTask('update-document', async () => {
      await prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: {
            id: document.id,
          },
          data: {
            status: DocumentStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        await tx.documentData.update({
          where: {
            id: documentData.id,
          },
          data: {
            data: newData,
          },
        });

        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
            documentId: document.id,
            requestMetadata,
            user: null,
            data: {
              transactionId: nanoid(),
            },
          }),
        });
      });
    });

    await io.runTask('send-completed-email', async () => {
      let shouldSendCompletedEmail = sendEmail && !isResealing;

      if (isResealing && documentStatus !== DocumentStatus.COMPLETED) {
        shouldSendCompletedEmail = sendEmail;
      }

      if (shouldSendCompletedEmail) {
        await sendCompletedEmail({ documentId, requestMetadata });
      }
    });

    const updatedDocument = await prisma.document.findFirstOrThrow({
      where: {
        id: document.id,
      },
      include: {
        documentData: true,
        Recipient: true,
      },
    });

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_COMPLETED,
      data: updatedDocument,
      userId: updatedDocument.userId,
      teamId: updatedDocument.teamId ?? undefined,
    });
  },
} as const satisfies JobDefinition<
  typeof SEAL_DOCUMENT_JOB_DEFINITION_ID,
  z.infer<typeof SEAL_DOCUMENT_JOB_DEFINITION_SCHEMA>
>;
