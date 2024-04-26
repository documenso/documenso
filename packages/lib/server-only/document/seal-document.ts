'use server';

import { nanoid } from 'nanoid';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

import PostHogServerClient from '@documenso/lib/server-only/feature-flags/get-post-hog-server-client';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SigningStatus } from '@documenso/prisma/client';
import { WebhookTriggerEvents } from '@documenso/prisma/client';
import { signPdf } from '@documenso/signing';

import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getFile } from '../../universal/upload/get-file';
import { putFile } from '../../universal/upload/put-file';
import { getCertificatePdf } from '../htmltopdf/get-certificate-pdf';
import { flattenAnnotations } from '../pdf/flatten-annotations';
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
  'use server';

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      documentData: true,
      Recipient: true,
    },
  });

  const { documentData } = document;

  if (!documentData) {
    throw new Error(`Document ${document.id} has no document data`);
  }

  if (document.status !== DocumentStatus.COMPLETED) {
    throw new Error(`Document ${document.id} has not been completed`);
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
  const getFileTime = Date.now();
  console.log('getFileStart:' + getFileTime);
  const pdfData = await getFile(documentData);
  console.log('getFileEnd:' + (Date.now() - getFileTime));

  const getCertificatePdfTime = Date.now();
  console.log('getCertificatePdfStart:' + getCertificatePdfTime);
  const certificate = await getCertificatePdf({ documentId }).then(async (doc) =>
    PDFDocument.load(doc),
  );
  console.log('getCertificatePdfEnd:' + (Date.now() - getCertificatePdfTime));

  const loadDoc = Date.now();
  console.log('loadDocStart:' + loadDoc);
  const doc = await PDFDocument.load(pdfData);
  console.log('loadDocEnd:' + (Date.now() - loadDoc));

  // Normalize and flatten layers that could cause issues with the signature
  normalizeSignatureAppearances(doc);
  doc.getForm().flatten();
  flattenAnnotations(doc);

  const certificatePageTime = Date.now();
  console.log('certificatePageStart:' + certificatePageTime);

  const certificatePages = await doc.copyPages(certificate, certificate.getPageIndices());
  console.log('certificatePageEnd:' + (Date.now() - certificatePageTime));

  certificatePages.forEach((page) => {
    doc.addPage(page);
  });

  for (const field of fields) {
    const insertFIeldTime = Date.now();
    console.log('insertFieldStart:' + insertFIeldTime);
    await insertFieldInPDF(doc, field);
    console.log('insertFieldEnd:' + (Date.now() - insertFIeldTime));
  }

  const docSaveTime = Date.now();
  console.log('docSaveStart:' + docSaveTime);

  const pdfBytes = await doc.save();
  console.log('docSaveEnd:' + (Date.now() - docSaveTime));

  const pdfBufferTIme = Date.now();
  console.log('pdfBufferStart:' + pdfBufferTIme);
  const pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });
  console.log('pdfBufferEnd:' + (Date.now() - pdfBufferTIme));

  const { name, ext } = path.parse(document.title);

  const putFIleTIme = Date.now();
  console.log('putFileStart:' + putFIleTIme);

  const { data: newData } = await putFile({
    name: `${name}_signed${ext}`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(pdfBuffer),
  });

  console.log('putFileEnd:' + (Date.now() - putFIleTIme));

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

  const updateDocumentTime = Date.now();
  console.log('updateDocumentStart:' + updateDocumentTime);

  await prisma.$transaction(async (tx) => {
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

  console.log('updateDocumentEnd:' + (Date.now() - updateDocumentTime));

  if (sendEmail && !isResealing) {
    const sendCompleteEmailTime = Date.now();
    console.log('sendCompleteEmailStart:' + sendCompleteEmailTime);
    await sendCompletedEmail({ documentId, requestMetadata });
    console.log('sendCompleteEmailEnd:' + (Date.now() - sendCompleteEmailTime));
  }

  const asdfasdfasdf = Date.now();
  console.log('updateDocumentStart:' + asdfasdfasdf);

  const updatedDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: document.id,
    },
    include: {
      documentData: true,
      Recipient: true,
    },
  });
  console.log('updateDocumentEnd:' + (Date.now() - asdfasdfasdf));

  const triggerWebhookTime = Date.now();
  console.log('triggerWebhookStart:' + triggerWebhookTime);

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_COMPLETED,
    data: updatedDocument,
    userId: document.userId,
    teamId: document.teamId ?? undefined,
  });
  console.log('triggerWebhookEnd:' + (Date.now() - triggerWebhookTime));
};
