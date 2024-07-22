import { sealDocument } from '@documenso/lib/server-only/document/seal-document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SendStatus, SigningStatus } from '@documenso/prisma/client';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import { jobsClient } from '../../jobs/client';
import { getFile } from '../../universal/upload/get-file';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type SendDocumentOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
  sendEmail?: boolean;
  requestMetadata?: RequestMetadata;
};

export const sendDocument = async ({
  documentId,
  userId,
  teamId,
  sendEmail = true,
  requestMetadata,
}: SendDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    include: {
      Recipient: true,
      documentMeta: true,
      documentData: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error('Can not send completed document');
  }

  const { documentData } = document;

  if (!documentData.data) {
    throw new Error('Document data not found');
  }

  if (document.formValues) {
    const file = await getFile(documentData);

    const prefilled = await insertFormValuesInPdf({
      pdf: Buffer.from(file),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      formValues: document.formValues as Record<string, string | number | boolean>,
    });

    const newDocumentData = await putPdfFile({
      name: document.title,
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

  if (sendEmail) {
    await Promise.all(
      document.Recipient.map(async (recipient) => {
        if (recipient.sendStatus === SendStatus.SENT || recipient.role === RecipientRole.CC) {
          return;
        }

        await jobsClient.triggerJob({
          name: 'send.signing.requested.email',
          payload: {
            userId,
            documentId,
            recipientId: recipient.id,
            requestMetadata,
          },
        });
      }),
    );
  }

  const allRecipientsHaveNoActionToTake = document.Recipient.every(
    (recipient) =>
      recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
  );

  if (allRecipientsHaveNoActionToTake) {
    await sealDocument({ documentId, requestMetadata });

    // Keep the return type the same for the `sendDocument` method
    return await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        Recipient: true,
      },
    });
  }

  const updatedDocument = await prisma.$transaction(async (tx) => {
    if (document.status === DocumentStatus.DRAFT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
          documentId: document.id,
          requestMetadata,
          user,
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
        Recipient: true,
      },
    });
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SENT,
    data: updatedDocument,
    userId,
    teamId,
  });

  return updatedDocument;
};
