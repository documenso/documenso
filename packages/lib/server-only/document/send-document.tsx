import {
  DocumentSigningOrder,
  DocumentStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { jobs } from '../../jobs/client';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { isDocumentCompleted } from '../../utils/document';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { getDocumentWhereInput } from './get-document-by-id';

export type SendDocumentOptions = {
  documentId: number;
  userId: number;
  teamId: number;
  sendEmail?: boolean;
  requestMetadata: ApiRequestMetadata;
};

export const sendDocument = async ({
  documentId,
  userId,
  teamId,
  sendEmail,
  requestMetadata,
}: SendDocumentOptions) => {
  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    include: {
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
      documentMeta: true,
      documentData: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (isDocumentCompleted(document.status)) {
    throw new Error('Can not send completed document');
  }

  const signingOrder = document.documentMeta?.signingOrder || DocumentSigningOrder.PARALLEL;

  let recipientsToNotify = document.recipients;

  if (signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    // Get the currently active recipient.
    recipientsToNotify = document.recipients
      .filter((r) => r.signingStatus === SigningStatus.NOT_SIGNED && r.role !== RecipientRole.CC)
      .slice(0, 1);

    // Secondary filter so we aren't resending if the current active recipient has already
    // received the document.
    recipientsToNotify.filter((r) => r.sendStatus !== SendStatus.SENT);
  }

  const { documentData } = document;

  if (!documentData.data) {
    throw new Error('Document data not found');
  }

  if (document.formValues) {
    const file = await getFileServerSide(documentData);

    const prefilled = await insertFormValuesInPdf({
      pdf: Buffer.from(file),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      formValues: document.formValues as Record<string, string | number | boolean>,
    });

    let fileName = document.title;

    if (!document.title.endsWith('.pdf')) {
      fileName = `${document.title}.pdf`;
    }

    const newDocumentData = await putPdfFileServerSide({
      name: fileName,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(prefilled),
    });

    const result = await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        documentDataId: newDocumentData.id,
      },
    });

    Object.assign(document, result);
  }

  // Commented out server side checks for minimum 1 signature per signer now since we need to
  // decide if we want to enforce this for API & templates.
  // const fields = await getFieldsForDocument({
  //   documentId: documentId,
  //   userId: userId,
  // });

  // const fieldsWithSignerEmail = fields.map((field) => ({
  //   ...field,
  //   signerEmail:
  //     document.Recipient.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
  // }));

  // const everySignerHasSignature = document?.Recipient.every(
  //   (recipient) =>
  //     recipient.role !== RecipientRole.SIGNER ||
  //     fieldsWithSignerEmail.some(
  //       (field) => field.type === 'SIGNATURE' && field.signerEmail === recipient.email,
  //     ),
  // );

  // if (!everySignerHasSignature) {
  //   throw new Error('Some signers have not been assigned a signature field.');
  // }

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientSigningRequest;

  // Only send email if one of the following is true:
  // - It is explicitly set
  // - The email is enabled for signing requests AND sendEmail is undefined
  if (sendEmail || (isRecipientSigningRequestEmailEnabled && sendEmail === undefined)) {
    await Promise.all(
      recipientsToNotify.map(async (recipient) => {
        if (recipient.sendStatus === SendStatus.SENT || recipient.role === RecipientRole.CC) {
          return;
        }

        await jobs.triggerJob({
          name: 'send.signing.requested.email',
          payload: {
            userId,
            documentId,
            recipientId: recipient.id,
            requestMetadata: requestMetadata?.requestMetadata,
          },
        });
      }),
    );
  }

  const allRecipientsHaveNoActionToTake = document.recipients.every(
    (recipient) =>
      recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
  );

  if (allRecipientsHaveNoActionToTake) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId,
        requestMetadata: requestMetadata?.requestMetadata,
      },
    });

    // Keep the return type the same for the `sendDocument` method
    return await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });
  }

  const updatedDocument = await prisma.$transaction(async (tx) => {
    if (document.status === DocumentStatus.DRAFT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
          documentId: document.id,
          metadata: requestMetadata,
          data: {},
        }),
      });
    }

    return await tx.document.update({
      where: {
        id: documentId,
      },
      data: {
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SENT,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(updatedDocument)),
    userId,
    teamId,
  });

  return updatedDocument;
};
