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
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { isDocumentCompleted } from '../../utils/document';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

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
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'documentId',
      id: documentId,
    },
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new Error('Can not send completed document');
  }

  const signingOrder = envelope.documentMeta?.signingOrder || DocumentSigningOrder.PARALLEL;

  let recipientsToNotify = envelope.recipients;

  if (signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    // Get the currently active recipient.
    recipientsToNotify = envelope.recipients
      .filter((r) => r.signingStatus === SigningStatus.NOT_SIGNED && r.role !== RecipientRole.CC)
      .slice(0, 1);

    // Secondary filter so we aren't resending if the current active recipient has already
    // received the envelope.
    recipientsToNotify.filter((r) => r.sendStatus !== SendStatus.SENT);
  }

  // Todo: Migration
  // const { documentData } = envelope;

  // if (!documentData.data) {
  //   throw new Error('Document data not found');
  // }

  // Todo: Migration
  // if (envelope.formValues) {
  //   const file = await getFileServerSide(documentData);

  //   const prefilled = await insertFormValuesInPdf({
  //     pdf: Buffer.from(file),
  //     // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //     formValues: envelope.formValues as Record<string, string | number | boolean>,
  //   });

  //   let fileName = envelope.title;

  //   if (!envelope.title.endsWith('.pdf')) {
  //     fileName = `${envelope.title}.pdf`;
  //   }

  //   const newDocumentData = await putPdfFileServerSide({
  //     name: fileName,
  //     type: 'application/pdf',
  //     arrayBuffer: async () => Promise.resolve(prefilled),
  //   });

  //   const result = await prisma.envelope.update({
  //     where: {
  //       id: envelope.id,
  //     },
  //     data: {
  //       documentDataId: newDocumentData.id,
  //     },
  //   });

  //   Object.assign(document, result);
  // }

  // Commented out server side checks for minimum 1 signature per signer now since we need to
  // decide if we want to enforce this for API & templates.
  // const fields = await getFieldsForDocument({
  //   documentId: documentId,
  //   userId: userId,
  // });

  // const fieldsWithSignerEmail = fields.map((field) => ({
  //   ...field,
  //   signerEmail:
  //     envelope.Recipient.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
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
    envelope.documentMeta,
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

  const allRecipientsHaveNoActionToTake = envelope.recipients.every(
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
    return await prisma.envelope.findFirstOrThrow({
      where: {
        id: envelope.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });
  }

  const updatedEnvelope = await prisma.$transaction(async (tx) => {
    if (envelope.status === DocumentStatus.DRAFT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
          envelopeId: envelope.id,
          metadata: requestMetadata,
          data: {},
        }),
      });
    }

    return await tx.envelope.update({
      where: {
        id: envelope.id,
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
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedEnvelope)),
    userId,
    teamId,
  });

  return updatedEnvelope;
};
