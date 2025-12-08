import {
  PDFDocument,
  RotationTypes,
  popGraphicsState,
  pushGraphicsState,
  radiansToDegrees,
  rotateDegrees,
  translate,
} from '@cantoo/pdf-lib';
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
import { groupBy } from 'remeda';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { signPdf } from '@documenso/signing';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import { getAuditLogsPdf } from '../../../server-only/htmltopdf/get-audit-logs-pdf';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { addRejectionStampToPdf } from '../../../server-only/pdf/add-rejection-stamp-to-pdf';
import { flattenAnnotations } from '../../../server-only/pdf/flatten-annotations';
import { flattenForm } from '../../../server-only/pdf/flatten-form';
import { getPageSize } from '../../../server-only/pdf/get-page-size';
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

  const { envelopeId, envelopeStatus, isRejected } = await io.runTask('seal-document', async () => {
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

    let envelopeItems = envelope.envelopeItems;

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
        certificateData,
        auditLogData,
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
  certificateData: Buffer | null;
  auditLogData: Buffer | null;
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

  // Handle V1 and legacy insertions.
  if (envelope.internalVersion === 1) {
    for (const field of envelopeItemFields) {
      if (field.inserted) {
        if (envelope.useLegacyFieldInsertion) {
          await legacy_insertFieldInPDF(pdfDoc, field);
        } else {
          await insertFieldInPDFV1(pdfDoc, field);
        }
      }
    }
  }

  // Handle V2 envelope insertions.
  if (envelope.internalVersion === 2) {
    const fieldsGroupedByPage = groupBy(envelopeItemFields, (field) => field.page);

    for (const [pageNumber, fields] of Object.entries(fieldsGroupedByPage)) {
      const page = pdfDoc.getPage(Number(pageNumber) - 1);
      const pageRotation = page.getRotation();

      let { width: pageWidth, height: pageHeight } = getPageSize(page);

      let pageRotationInDegrees = match(pageRotation.type)
        .with(RotationTypes.Degrees, () => pageRotation.angle)
        .with(RotationTypes.Radians, () => radiansToDegrees(pageRotation.angle))
        .exhaustive();

      // Round to the closest multiple of 90 degrees.
      pageRotationInDegrees = Math.round(pageRotationInDegrees / 90) * 90;

      // PDFs can have pages that are rotated, which are correctly rendered in the frontend.
      // However when we load the PDF in the backend, the rotation is applied.
      // To account for this, we swap the width and height for pages that are rotated by 90/270
      // degrees. This is so we can calculate the virtual position the field was placed if it
      // was correctly oriented in the frontend.
      if (pageRotationInDegrees === 90 || pageRotationInDegrees === 270) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }

      // Rotate the page to the orientation that the react-pdf renders on the frontend.
      // Note: These transformations are undone at the end of the function.
      // If you change this if statement, update the if statement at the end as well
      if (pageRotationInDegrees !== 0) {
        let translateX = 0;
        let translateY = 0;

        switch (pageRotationInDegrees) {
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
          case 0:
          default:
            translateX = 0;
            translateY = 0;
        }

        page.pushOperators(pushGraphicsState());
        page.pushOperators(translate(translateX, translateY), rotateDegrees(pageRotationInDegrees));
      }

      const renderedPdfOverlay = await insertFieldInPDFV2({
        pageWidth,
        pageHeight,
        fields,
      });

      const [embeddedPage] = await pdfDoc.embedPdf(renderedPdfOverlay);

      // Draw the SVG on the page
      page.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Remove the transformations applied to the page if any were applied.
      if (pageRotationInDegrees !== 0) {
        page.pushOperators(popGraphicsState());
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
