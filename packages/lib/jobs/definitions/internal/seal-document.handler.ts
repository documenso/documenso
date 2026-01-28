import { PDFDocument } from '@cantoo/pdf-lib';
import { PDF } from '@libpdf/core';
import type { DocumentData, Envelope, EnvelopeItem, Field } from '@prisma/client';
import {
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';
import { nanoid } from 'nanoid';
import path from 'node:path';
import { groupBy } from 'remeda';

import { addRejectionStampToPdf } from '@documenso/lib/server-only/pdf/add-rejection-stamp-to-pdf';
import { generateAuditLogPdf } from '@documenso/lib/server-only/pdf/generate-audit-log-pdf';
import { generateCertificatePdf } from '@documenso/lib/server-only/pdf/generate-certificate-pdf';
import { prisma } from '@documenso/prisma';
import { signPdf } from '@documenso/signing';

import { NEXT_PRIVATE_USE_PLAYWRIGHT_PDF } from '../../../constants/app';
import { PDF_SIZE_A4_72PPI } from '../../../constants/pdf';
import { AppError, AppErrorCode } from '../../../errors/app-error';
import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import { getAuditLogsPdf } from '../../../server-only/htmltopdf/get-audit-logs-pdf';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { insertFieldInPDFV1 } from '../../../server-only/pdf/insert-field-in-pdf-v1';
import { insertFieldInPDFV2 } from '../../../server-only/pdf/insert-field-in-pdf-v2';
import { legacy_insertFieldInPDF } from '../../../server-only/pdf/legacy-insert-field-in-pdf';
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
import { mapDocumentIdToSecondaryId } from '../../../utils/envelope';
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

  const { envelopeId, envelopeStatus, isRejected } = await io.runTask('seal-document', async () => {
    const envelope = await prisma.envelope.findFirstOrThrow({
      where: {
        type: EnvelopeType.DOCUMENT,
        secondaryId: mapDocumentIdToSecondaryId(documentId),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        documentMeta: true,
        recipients: true,
        fields: {
          include: {
            signature: true,
          },
        },
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

    // Ensure all CC recipients are marked as signed
    await prisma.recipient.updateMany({
      where: {
        envelopeId: envelope.id,
        role: RecipientRole.CC,
      },
      data: {
        signingStatus: SigningStatus.SIGNED,
      },
    });

    const isComplete =
      envelope.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
      envelope.recipients.every(
        (recipient) =>
          recipient.signingStatus === SigningStatus.SIGNED || recipient.role === RecipientRole.CC,
      );

    if (!isComplete) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Document is not complete',
      });
    }

    let { envelopeItems } = envelope;

    const fields = envelope.fields;

    if (envelopeItems.length < 1) {
      throw new Error(`Document ${envelope.id} has no envelope items`);
    }

    const recipientsWithoutCCers = envelope.recipients.filter(
      (recipient) => recipient.role !== RecipientRole.CC,
    );

    // Determine if the document has been rejected by checking if any recipient has rejected it
    const rejectedRecipient = recipientsWithoutCCers.find(
      (recipient) => recipient.signingStatus === SigningStatus.REJECTED,
    );

    const isRejected = Boolean(rejectedRecipient);

    // Get the rejection reason from the rejected recipient
    const rejectionReason = rejectedRecipient?.rejectionReason ?? '';

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

    let certificateDoc: PDF | null = null;
    let auditLogDoc: PDF | null = null;

    if (settings.includeSigningCertificate || settings.includeAuditLog) {
      const certificatePayload = {
        envelope,
        recipients: envelope.recipients, // Need to use the recipients from envelope which contains ALL recipients.
        fields,
        language: envelope.documentMeta.language,
        envelopeOwner: {
          email: envelope.user.email,
          name: envelope.user.name || '',
        },
        envelopeItems: envelopeItems.map((item) => item.title),
        pageWidth: PDF_SIZE_A4_72PPI.width,
        pageHeight: PDF_SIZE_A4_72PPI.height,
      };

      // Use Playwright-based PDF generation if enabled, otherwise use Konva-based generation.
      // This is a temporary toggle while we validate the Konva-based approach.
      const usePlaywrightPdf = NEXT_PRIVATE_USE_PLAYWRIGHT_PDF();

      const makeCertificatePdf = async () =>
        usePlaywrightPdf
          ? getCertificatePdf({
              documentId,
              language: envelope.documentMeta.language,
            }).then(async (buffer) => PDF.load(buffer))
          : generateCertificatePdf(certificatePayload);

      const makeAuditLogPdf = async () =>
        usePlaywrightPdf
          ? getAuditLogsPdf({
              documentId,
              language: envelope.documentMeta.language,
            }).then(async (buffer) => PDF.load(buffer))
          : generateAuditLogPdf(certificatePayload);

      const [createdCertificatePdf, createdAuditLogPdf] = await Promise.all([
        settings.includeSigningCertificate ? makeCertificatePdf() : null,
        settings.includeAuditLog ? makeAuditLogPdf() : null,
      ]);

      certificateDoc = createdCertificatePdf;
      auditLogDoc = createdAuditLogPdf;
    }

    const newDocumentData: Array<{ oldDocumentDataId: string; newDocumentDataId: string }> = [];

    for (const envelopeItem of envelopeItems) {
      const envelopeItemFields = envelope.envelopeItems.find(
        (item) => item.id === envelopeItem.id,
      )?.field;

      if (!envelopeItemFields) {
        throw new Error(`Envelope item fields not found for envelope item ${envelopeItem.id}`);
      }

      const result = await decorateAndSignPdf({
        envelope,
        envelopeItem,
        envelopeItemFields,
        isRejected,
        rejectionReason,
        certificateDoc,
        auditLogDoc,
      });

      newDocumentData.push(result);
    }

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

    return {
      envelopeId: envelope.id,
      envelopeStatus: envelope.status,
      isRejected,
    };
  });

  await io.runTask('send-completed-email', async () => {
    let shouldSendCompletedEmail = sendEmail && !isResealing && !isRejected;

    if (isResealing && !isDocumentCompleted(envelopeStatus)) {
      shouldSendCompletedEmail = sendEmail;
    }

    if (shouldSendCompletedEmail) {
      await sendCompletedEmail({
        id: { type: 'envelopeId', id: envelopeId },
        requestMetadata,
      });
    }
  });

  const updatedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: envelopeId,
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
  envelopeItem: EnvelopeItem & { documentData: DocumentData };
  envelopeItemFields: Field[];
  isRejected: boolean;
  rejectionReason: string;
  certificateDoc: PDF | null;
  auditLogDoc: PDF | null;
};

/**
 * Fetch, normalize, flatten and insert fields into a PDF document.
 */
const decorateAndSignPdf = async ({
  envelope,
  envelopeItem,
  envelopeItemFields,
  isRejected,
  rejectionReason,
  certificateDoc,
  auditLogDoc,
}: DecorateAndSignPdfOptions) => {
  const pdfData = await getFileServerSide(envelopeItem.documentData);

  let pdfDoc = await PDF.load(pdfData);

  // Normalize and flatten layers that could cause issues with the signature
  pdfDoc.flattenAll();
  // Upgrade to PDF 1.7 for better compatibility with signing
  pdfDoc.upgradeVersion('1.7');

  // Add rejection stamp if the document is rejected
  if (isRejected) {
    await addRejectionStampToPdf(pdfDoc, rejectionReason);
  }

  if (certificateDoc) {
    await pdfDoc.copyPagesFrom(
      certificateDoc,
      Array.from({ length: certificateDoc.getPageCount() }, (_, index) => index),
    );
  }

  if (auditLogDoc) {
    await pdfDoc.copyPagesFrom(
      auditLogDoc,
      Array.from({ length: auditLogDoc.getPageCount() }, (_, index) => index),
    );
  }

  // Handle V1 and legacy insertions.
  if (envelope.internalVersion === 1) {
    const legacy_pdfLibDoc = await PDFDocument.load(await pdfDoc.save({ useXRefStream: true }));

    for (const field of envelopeItemFields) {
      if (field.inserted) {
        if (envelope.useLegacyFieldInsertion) {
          await legacy_insertFieldInPDF(legacy_pdfLibDoc, field);
        } else {
          await insertFieldInPDFV1(legacy_pdfLibDoc, field);
        }
      }
    }

    await pdfDoc.reload(await legacy_pdfLibDoc.save());
  }

  // Handle V2 envelope insertions.
  if (envelope.internalVersion === 2) {
    const fieldsGroupedByPage = groupBy(envelopeItemFields, (field) => field.page);

    for (const [pageNumber, fields] of Object.entries(fieldsGroupedByPage)) {
      const page = pdfDoc.getPage(Number(pageNumber) - 1);

      if (!page) {
        throw new Error(`Page ${pageNumber} does not exist`);
      }

      const pageWidth = page.width;
      const pageHeight = page.height;

      const overlayBytes = await insertFieldInPDFV2({
        pageWidth,
        pageHeight,
        fields,
      });

      const overlayPdf = await PDF.load(overlayBytes);

      const embeddedPage = await pdfDoc.embedPage(overlayPdf, 0);

      // Rotate the page to the orientation that the react-pdf renders on the frontend.
      let translateX = 0;
      let translateY = 0;

      switch (page.rotation) {
        case 90:
          translateX = pageHeight;
          translateY = 0;
          break;
        case 180:
          translateX = pageWidth;
          translateY = pageHeight;
          break;
        case 270:
          translateX = 0;
          translateY = pageWidth;
          break;
      }

      // Draw the overlay on the page
      page.drawPage(embeddedPage, {
        x: translateX,
        y: translateY,
        rotate: {
          angle: page.rotation,
        },
      });
    }
  }

  // Re-flatten the form to handle our checkbox and radio fields that
  // create native arcoFields
  pdfDoc.flattenAll();

  pdfDoc = await PDF.load(await pdfDoc.save({ useXRefStream: true }));

  const pdfBytes = await signPdf({ pdf: pdfDoc });

  const { name } = path.parse(envelopeItem.title);

  // Add suffix based on document status
  const suffix = isRejected ? '_rejected.pdf' : '_signed.pdf';

  const newDocumentData = await putPdfFileServerSide({
    name: `${name}${suffix}`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(pdfBytes),
  });

  return {
    oldDocumentDataId: envelopeItem.documentData.id,
    newDocumentDataId: newDocumentData.id,
  };
};
