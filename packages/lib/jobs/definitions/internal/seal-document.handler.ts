import { PDFDocument } from '@cantoo/pdf-lib';
import type { DocumentData, DocumentMeta, Envelope, EnvelopeItem, Field } from '@prisma/client';
import {
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';
import { nanoid } from 'nanoid';
import path from 'node:path';

import { prisma } from '@documenso/prisma';
import { signPdf } from '@documenso/signing';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import PostHogServerClient from '../../../server-only/feature-flags/get-post-hog-server-client';
import { getAuditLogsPdf } from '../../../server-only/htmltopdf/get-audit-logs-pdf';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { addRejectionStampToPdf } from '../../../server-only/pdf/add-rejection-stamp-to-pdf';
import { flattenAnnotations } from '../../../server-only/pdf/flatten-annotations';
import { flattenForm } from '../../../server-only/pdf/flatten-form';
import { insertFieldInPDFV1 } from '../../../server-only/pdf/insert-field-in-pdf-v1';
import { insertFieldInPDFV2 } from '../../../server-only/pdf/insert-field-in-pdf-v2';
import { legacy_insertFieldInPDF } from '../../../server-only/pdf/legacy-insert-field-in-pdf';
import { normalizeSignatureAppearances } from '../../../server-only/pdf/normalize-signature-appearances';
import { getTeamSettings } from '../../../server-only/team/get-team-settings';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../../types/webhook-payload';
import { prefixedId } from '../../../universal/id';
import { getFileServerSide } from '../../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../../universal/upload/put-file.server';
import { fieldsContainUnsignedRequiredField } from '../../../utils/advanced-fields-helpers';
import { isDocumentCompleted } from '../../../utils/document';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { mapDocumentIdToSecondaryId, mapSecondaryIdToDocumentId } from '../../../utils/envelope';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSealDocumentJobDefinition } from './seal-document';

export const run = async ({
  payload,
  io,
}: {
  payload: TSealDocumentJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, sendEmail = true, isResealing = false, requestMetadata } = payload;

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      type: EnvelopeType.DOCUMENT,
      secondaryId: mapDocumentIdToSecondaryId(documentId),
    },
    include: {
      documentMeta: true,
      recipients: true,
      envelopeItems: {
        include: {
          documentData: true,
          field: {
            include: {
              signature: true,
            },
          },
        },
      },
    },
  });

  if (envelope.envelopeItems.length === 0) {
    throw new Error('At least one envelope item required');
  }

  const settings = await getTeamSettings({
    userId: envelope.userId,
    teamId: envelope.teamId,
  });

  const isComplete =
    envelope.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
    envelope.recipients.every((recipient) => recipient.signingStatus === SigningStatus.SIGNED);

  if (!isComplete) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Document is not complete',
    });
  }

  // Seems silly but we need to do this in case the job is re-ran
  // after it has already run through the update task further below.
  // eslint-disable-next-line @typescript-eslint/require-await
  const documentStatus = await io.runTask('get-document-status', async () => {
    return envelope.status;
  });

  // This is the same case as above.
  let envelopeItems: typeof envelope.envelopeItems = await io.runTask(
    'get-document-data-id', // Todo: Envelopes [PRE-MAIN] - Fix these messed up types.
    // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-explicit-any
    async (): Promise<any> => {
      return envelope.envelopeItems.map((envelopeItem) => ({
        ...envelopeItem,
        fields: envelopeItem.field.map((field) => ({
          ...field,
          positionX: Number(field.positionX),
          positionY: Number(field.positionY),
          width: Number(field.width),
          height: Number(field.height),
        })),
      }));
    },
  );

  if (envelopeItems.length < 1) {
    throw new Error(`Document ${envelope.id} has no envelope items`);
  }

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId: envelope.id,
      role: {
        not: RecipientRole.CC,
      },
    },
  });

  // Determine if the document has been rejected by checking if any recipient has rejected it
  const rejectedRecipient = recipients.find(
    (recipient) => recipient.signingStatus === SigningStatus.REJECTED,
  );

  const isRejected = Boolean(rejectedRecipient);

  // Get the rejection reason from the rejected recipient
  const rejectionReason = rejectedRecipient?.rejectionReason ?? '';

  const fields = await prisma.field.findMany({
    where: {
      envelopeId: envelope.id,
    },
    include: {
      signature: true,
    },
  });

  // Skip the field check if the document is rejected
  if (!isRejected && fieldsContainUnsignedRequiredField(fields)) {
    throw new Error(`Document ${envelope.id} has unsigned required fields`);
  }

  if (isResealing) {
    // If we're resealing we want to use the initial data for the document
    // so we aren't placing fields on top of eachother.
    envelopeItems = envelopeItems.map((envelopeItem) => ({
      ...envelopeItem,
      documentData: {
        ...envelopeItem.documentData,
        data: envelopeItem.documentData.initialData,
      },
    }));
  }

  if (!envelope.qrToken) {
    await prisma.envelope.update({
      where: {
        id: envelope.id,
      },
      data: {
        qrToken: prefixedId('qr'),
      },
    });
  }

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  const { certificateData, auditLogData } = await getCertificateAndAuditLogData({
    legacyDocumentId,
    documentMeta: envelope.documentMeta,
    settings,
  });

  const newDocumentData = await Promise.all(
    envelopeItems.map(async (envelopeItem) =>
      io.runTask('decorate-and-sign-pdf', async () =>
        decorateAndSignPdf({
          envelope,
          envelopeItem,
          isRejected,
          rejectionReason,
          certificateData,
          auditLogData,
        }),
      ),
    ),
  );

  const postHog = PostHogServerClient();

  if (postHog) {
    postHog.capture({
      distinctId: nanoid(),
      event: 'App: Document Sealed',
      properties: {
        documentId: envelope.id,
        isRejected,
      },
    });
  }

  await io.runTask('update-document', async () => {
    await prisma.$transaction(async (tx) => {
      for (const { oldDocumentDataId, newDocumentDataId } of newDocumentData) {
        const newData = await tx.documentData.findFirstOrThrow({
          where: {
            id: newDocumentDataId,
          },
        });

        await tx.documentData.update({
          where: {
            id: oldDocumentDataId,
          },
          data: {
            data: newData.data,
          },
        });
      }

      await tx.envelope.update({
        where: {
          id: envelope.id,
        },
        data: {
          status: isRejected ? DocumentStatus.REJECTED : DocumentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
          envelopeId: envelope.id,
          requestMetadata,
          user: null,
          data: {
            transactionId: nanoid(),
            ...(isRejected ? { isRejected: true, rejectionReason: rejectionReason } : {}),
          },
        }),
      });
    });
  });

  await io.runTask('send-completed-email', async () => {
    let shouldSendCompletedEmail = sendEmail && !isResealing && !isRejected;

    if (isResealing && !isDocumentCompleted(envelope.status)) {
      shouldSendCompletedEmail = sendEmail;
    }

    if (shouldSendCompletedEmail) {
      await sendCompletedEmail({
        id: { type: 'envelopeId', id: envelope.id },
        requestMetadata,
      });
    }
  });

  const updatedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: envelope.id,
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });

  await triggerWebhook({
    event: isRejected
      ? WebhookTriggerEvents.DOCUMENT_REJECTED
      : WebhookTriggerEvents.DOCUMENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedEnvelope)),
    userId: updatedEnvelope.userId,
    teamId: updatedEnvelope.teamId ?? undefined,
  });
};

type DecorateAndSignPdfOptions = {
  envelope: Pick<Envelope, 'id' | 'title' | 'useLegacyFieldInsertion' | 'internalVersion'>;
  envelopeItem: EnvelopeItem & { documentData: DocumentData; field: Field[] };
  isRejected: boolean;
  rejectionReason: string;
  certificateData: Buffer | null;
  auditLogData: Buffer | null;
};

/**
 * Fetch, normalize, flatten and insert fields into a PDF document.
 */
const decorateAndSignPdf = async ({
  envelope,
  envelopeItem,
  isRejected,
  rejectionReason,
  certificateData,
  auditLogData,
}: DecorateAndSignPdfOptions) => {
  const pdfData = await getFileServerSide(envelopeItem.documentData);

  const pdfDoc = await PDFDocument.load(pdfData);

  // Normalize and flatten layers that could cause issues with the signature
  normalizeSignatureAppearances(pdfDoc);
  await flattenForm(pdfDoc);
  flattenAnnotations(pdfDoc);

  // Add rejection stamp if the document is rejected
  if (isRejected && rejectionReason) {
    await addRejectionStampToPdf(pdfDoc, rejectionReason);
  }

  if (certificateData) {
    const certificateDoc = await PDFDocument.load(certificateData);

    const certificatePages = await pdfDoc.copyPages(
      certificateDoc,
      certificateDoc.getPageIndices(),
    );

    certificatePages.forEach((page) => {
      pdfDoc.addPage(page);
    });
  }

  if (auditLogData) {
    const auditLogDoc = await PDFDocument.load(auditLogData);

    const auditLogPages = await pdfDoc.copyPages(auditLogDoc, auditLogDoc.getPageIndices());

    auditLogPages.forEach((page) => {
      pdfDoc.addPage(page);
    });
  }

  for (const field of envelopeItem.field) {
    if (field.inserted) {
      if (envelope.internalVersion === 2) {
        await insertFieldInPDFV2(pdfDoc, field);
      } else if (envelope.useLegacyFieldInsertion) {
        await legacy_insertFieldInPDF(pdfDoc, field);
      } else {
        await insertFieldInPDFV1(pdfDoc, field);
      }
    }
  }

  // Re-flatten the form to handle our checkbox and radio fields that
  // create native arcoFields
  await flattenForm(pdfDoc);

  const pdfBytes = await pdfDoc.save();

  const pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

  const { name } = path.parse(envelopeItem.title);

  // Add suffix based on document status
  const suffix = isRejected ? '_rejected.pdf' : '_signed.pdf';

  const newDocumentData = await putPdfFileServerSide({
    name: `${name}${suffix}`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(pdfBuffer),
  });

  return {
    oldDocumentDataId: envelopeItem.documentData.id,
    newDocumentDataId: newDocumentData.id,
  };
};

export const getCertificateAndAuditLogData = async ({
  legacyDocumentId,
  documentMeta,
  settings,
}: {
  legacyDocumentId: number;
  documentMeta: DocumentMeta;
  settings: { includeSigningCertificate: boolean; includeAuditLog: boolean };
}) => {
  const getCertificateDataPromise = settings.includeSigningCertificate
    ? getCertificatePdf({
        documentId: legacyDocumentId,
        language: documentMeta.language,
      }).catch((e) => {
        console.log('Failed to get certificate PDF');
        console.error(e);

        return null;
      })
    : null;

  const getAuditLogDataPromise = settings.includeAuditLog
    ? getAuditLogsPdf({
        documentId: legacyDocumentId,
        language: documentMeta.language,
      }).catch((e) => {
        console.log('Failed to get audit logs PDF');
        console.error(e);

        return null;
      })
    : null;

  const [certificateData, auditLogData] = await Promise.all([
    getCertificateDataPromise,
    getAuditLogDataPromise,
  ]);

  return {
    certificateData,
    auditLogData,
  };
};
