import { nanoid } from 'nanoid';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

import PostHogServerClient from '@documenso/lib/server-only/feature-flags/get-post-hog-server-client';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  RecipientRole,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';
import { signPdf } from '@documenso/signing';

import { ZWebhookDocumentSchema } from '../../types/webhook-payload';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getFile } from '../../universal/upload/get-file';
import { putPdfFile } from '../../universal/upload/put-file';
import { getCertificatePdf } from '../htmltopdf/get-certificate-pdf';
import { flattenAnnotations } from '../pdf/flatten-annotations';
import { flattenForm } from '../pdf/flatten-form';
import { insertFieldInPDF } from '../pdf/insert-field-in-pdf';
import { normalizeSignatureAppearances } from '../pdf/normalize-signature-appearances';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { sendCompletedEmail } from './send-completed-email';

export type SealDocumentOptions = {
  documentId: number;
  sendEmail?: boolean;
  isResealing?: boolean;
  requestMetadata?: RequestMetadata;
};

export const sealDocument = async ({
  documentId,
  sendEmail = true,
  isResealing = false,
  requestMetadata,
}: SealDocumentOptions) => {
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
      documentMeta: true,
      Recipient: true,
      team: {
        select: {
          teamGlobalSettings: {
            select: {
              includeSigningCertificate: true,
            },
          },
        },
      },
    },
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

  // !: Need to write the fields onto the document as a hard copy
  const pdfData = await getFile(documentData);

  const certificateData =
    (document.team?.teamGlobalSettings?.includeSigningCertificate ?? true)
      ? await getCertificatePdf({
          documentId,
          language: document.documentMeta?.language,
        }).catch(() => null)
      : null;

  const doc = await PDFDocument.load(pdfData);

  // Normalize and flatten layers that could cause issues with the signature
  normalizeSignatureAppearances(doc);
  flattenForm(doc);
  flattenAnnotations(doc);

  if (certificateData) {
    const certificate = await PDFDocument.load(certificateData);

    const certificatePages = await doc.copyPages(certificate, certificate.getPageIndices());

    certificatePages.forEach((page) => {
      doc.addPage(page);
    });
  }

  for (const field of fields) {
    await insertFieldInPDF(doc, field);
  }

  // Re-flatten post-insertion to handle fields that create arcoFields
  flattenForm(doc);

  const pdfBytes = await doc.save();

  const pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

  const { name } = path.parse(document.title);

  const { data: newData } = await putPdfFile({
    name: `${name}_signed.pdf`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(pdfBuffer),
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

  if (sendEmail && !isResealing) {
    await sendCompletedEmail({ documentId, requestMetadata });
  }

  const updatedDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: document.id,
    },
    include: {
      documentData: true,
      documentMeta: true,
      Recipient: true,
    },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(updatedDocument),
    userId: document.userId,
    teamId: document.teamId ?? undefined,
  });
};
