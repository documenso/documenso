import { prisma } from '@documenso/prisma';
import type { DocumentMeta, Envelope, Recipient, User } from '@prisma/client';
import { DocumentStatus, EnvelopeType, RecipientRole, SendStatus, WebhookTriggerEvents } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { isDocumentCompleted } from '../../utils/document';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { type EnvelopeIdOptions, unsafeBuildEnvelopeIdQuery } from '../../utils/envelope';
import { isRecipientEmailValidForSending } from '../../utils/recipients';
import { getEmailContext } from '../email/get-email-context';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type DeleteDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  requestMetadata: ApiRequestMetadata;
};

export const deleteDocument = async ({ id, userId, teamId, requestMetadata }: DeleteDocumentOptions) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  // Note: This is an unsafe request. It is used purely to resolve the recipient
  // self-hide path below. The authoritative delete authorization is performed
  // via the visibility-aware `getEnvelopeWhereInput` helper.
  const envelope = await prisma.envelope.findUnique({
    where: unsafeBuildEnvelopeIdQuery(id, EnvelopeType.DOCUMENT),
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  // Determine whether the user has authorized delete access using the
  // visibility-aware helper. This enforces ownership OR (team membership AND
  // the document's visibility is permitted for the member's role) OR team-email
  // access. A bare team member without sufficient visibility will resolve to
  // null here and therefore must not be able to delete the document.
  const hasDeleteAccess = await getEnvelopeWhereInput({
    id,
    userId,
    teamId,
    type: EnvelopeType.DOCUMENT,
  })
    .then(({ envelopeWhereInput }) =>
      prisma.envelope.findFirst({
        where: envelopeWhereInput,
        select: { id: true },
      }),
    )
    .then((result) => Boolean(result))
    .catch(() => false);

  const userRecipient = envelope.recipients.find((recipient) => recipient.email === user.email);

  if (!hasDeleteAccess && !userRecipient) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Not allowed',
    });
  }

  // Handle hard or soft deleting the actual document if user has permission.
  if (hasDeleteAccess) {
    await handleDocumentOwnerDelete({
      envelope,
      user,
      requestMetadata,
    });

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CANCELLED,
      data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelope)),
      userId,
      teamId,
    });
  }

  // Continue to hide the document from the user if they are a recipient.
  // Dirty way of doing this but it's faster than refetching the document.
  if (userRecipient?.documentDeletedAt === null) {
    await prisma.recipient
      .update({
        where: {
          id: userRecipient.id,
        },
        data: {
          documentDeletedAt: new Date().toISOString(),
        },
      })
      .catch(() => {
        // Do nothing.
      });
  }

  return envelope;
};

type HandleDocumentOwnerDeleteOptions = {
  envelope: Envelope & {
    recipients: Recipient[];
    documentMeta: DocumentMeta | null;
  };
  user: User;
  requestMetadata: ApiRequestMetadata;
};

const handleDocumentOwnerDelete = async ({ envelope, user, requestMetadata }: HandleDocumentOwnerDeleteOptions) => {
  if (envelope.deletedAt) {
    return;
  }

  const { emailLanguage, emailsDisabled } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  // Soft delete completed documents.
  if (isDocumentCompleted(envelope.status)) {
    return await prisma.$transaction(async (tx) => {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          envelopeId: envelope.id,
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
          metadata: requestMetadata,
          data: {
            type: 'SOFT',
          },
        }),
      });

      return await tx.envelope.update({
        where: {
          id: envelope.id,
        },
        data: {
          deletedAt: new Date().toISOString(),
        },
      });
    });
  }

  // Hard delete draft and pending documents.
  const deletedEnvelope = await prisma.$transaction(async (tx) => {
    // Currently redundant since deleting a document will delete the audit logs.
    // However may be useful if we disassociate audit logs and documents if required.
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        envelopeId: envelope.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        metadata: requestMetadata,
        data: {
          type: 'HARD',
        },
      }),
    });

    return await tx.envelope.delete({
      where: {
        id: envelope.id,
        status: {
          not: DocumentStatus.COMPLETED,
        },
      },
    });
  });

  const isEnvelopeDeleteEmailEnabled = extractDerivedDocumentEmailSettings(envelope.documentMeta).documentDeleted;

  // Skip sending if the email is disabled for this document or the organisation
  // has email sending disabled entirely.
  if (!isEnvelopeDeleteEmailEnabled || emailsDisabled) {
    return deletedEnvelope;
  }

  // Enqueue cancellation emails as a background job. The envelope (and its
  // documentMeta) is hard-deleted above, so the job can't look it up later —
  // pass a self-contained payload with the recipients to notify.
  const recipientsToNotify = envelope.recipients
    .filter(
      (recipient) =>
        recipient.sendStatus === SendStatus.SENT &&
        recipient.role !== RecipientRole.CC &&
        isRecipientEmailValidForSending(recipient),
    )
    .map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
    }));

  if (recipientsToNotify.length > 0) {
    await jobs.triggerJob({
      name: 'send.document.deleted.emails',
      payload: {
        teamId: envelope.teamId,
        documentName: envelope.title,
        inviterName: user.name || undefined,
        inviterEmail: user.email,
        meta: envelope.documentMeta
          ? {
              emailId: envelope.documentMeta.emailId,
              emailReplyTo: envelope.documentMeta.emailReplyTo,
              language: emailLanguage,
            }
          : null,
        recipients: recipientsToNotify,
      },
    });
  }

  return deletedEnvelope;
};
