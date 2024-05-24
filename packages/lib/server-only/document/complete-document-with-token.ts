'use server';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import type { TRecipientActionAuth } from '../../types/document-auth';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { sealDocument } from './seal-document';
import { sendPendingEmail } from './send-pending-email';

export type CompleteDocumentWithTokenOptions = {
  token: string;
  documentId: number;
  userId?: number;
  authOptions?: TRecipientActionAuth;
  requestMetadata?: RequestMetadata;
};

const getDocument = async ({ token, documentId }: CompleteDocumentWithTokenOptions) => {
  return await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      Recipient: {
        some: {
          token,
        },
      },
    },
    include: {
      Recipient: {
        where: {
          token,
        },
      },
    },
  });
};

export const completeDocumentWithToken = async ({
  token,
  documentId,
  requestMetadata,
}: CompleteDocumentWithTokenOptions) => {
  'use server';

  const document = await getDocument({ token, documentId });

  if (document.status !== DocumentStatus.PENDING) {
    throw new Error(`Document ${document.id} must be pending`);
  }

  if (document.Recipient.length === 0) {
    throw new Error(`Document ${document.id} has no recipient with token ${token}`);
  }

  const [recipient] = document.Recipient;

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  const fields = await prisma.field.findMany({
    where: {
      documentId: document.id,
      recipientId: recipient.id,
    },
  });

  if (fields.some((field) => !field.inserted)) {
    throw new Error(`Recipient ${recipient.id} has unsigned fields`);
  }

  // Document reauth for completing documents is currently not required.

  // const { derivedRecipientActionAuth } = extractDocumentAuthMethods({
  //   documentAuth: document.authOptions,
  //   recipientAuth: recipient.authOptions,
  // });

  // const isValid = await isRecipientAuthorized({
  //   type: 'ACTION',
  //   document: document,
  //   recipient: recipient,
  //   userId,
  //   authOptions,
  // });

  // if (!isValid) {
  //   throw new AppError(AppErrorCode.UNAUTHORIZED, 'Invalid authentication values');
  // }

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        signingStatus: SigningStatus.SIGNED,
        signedAt: new Date(),
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
        documentId: document.id,
        user: {
          name: recipient.name,
          email: recipient.email,
        },
        requestMetadata,
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
          recipientRole: recipient.role,
          // actionAuth: derivedRecipientActionAuth || undefined,
        },
      }),
    });
  });

  const pendingRecipients = await prisma.recipient.count({
    where: {
      documentId: document.id,
      signingStatus: {
        not: SigningStatus.SIGNED,
      },
    },
  });

  if (pendingRecipients > 0) {
    await sendPendingEmail({ documentId, recipientId: recipient.id });
  }

  const haveAllRecipientsSigned = await prisma.document.findFirst({
    where: {
      id: document.id,
      Recipient: {
        every: {
          signingStatus: SigningStatus.SIGNED,
        },
      },
    },
  });

  if (haveAllRecipientsSigned) {
    await sealDocument({ documentId: document.id, requestMetadata });
  }

  const updatedDocument = await getDocument({ token, documentId });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SIGNED,
    data: updatedDocument,
    userId: updatedDocument.userId,
    teamId: updatedDocument.teamId ?? undefined,
  });
};
