import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { DocumentMeta, Envelope, Recipient, User } from '@prisma/client';
import { DocumentStatus, EnvelopeType, SendStatus, WebhookTriggerEvents } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { isDocumentCompleted } from '../../utils/document';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { type EnvelopeIdOptions, unsafeBuildEnvelopeIdQuery } from '../../utils/envelope';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';
import { getMemberRoles } from '../team/get-member-roles';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type DeleteDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  requestMetadata: ApiRequestMetadata;
};

export const deleteDocument = async ({
  id,
  userId,
  teamId,
  requestMetadata,
}: DeleteDocumentOptions) => {
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

  // Note: This is an unsafe request, we validate the ownership later in the function.
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

  const isUserTeamMember = await getMemberRoles({
    teamId: envelope.teamId,
    reference: {
      type: 'User',
      id: userId,
    },
  })
    .then(() => true)
    .catch(() => false);

  const isUserOwner = envelope.userId === userId;
  const userRecipient = envelope.recipients.find((recipient) => recipient.email === user.email);

  if (!isUserOwner && !isUserTeamMember && !userRecipient) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Not allowed',
    });
  }

  // Handle hard or soft deleting the actual document if user has permission.
  if (isUserOwner || isUserTeamMember) {
    await handleDocumentOwnerDelete({
      envelope,
      user,
      requestMetadata,
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

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CANCELLED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelope)),
    userId,
    teamId,
  });

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

const handleDocumentOwnerDelete = async ({
  envelope,
  user,
  requestMetadata,
}: HandleDocumentOwnerDeleteOptions) => {
  if (envelope.deletedAt) {
    return;
  }

  const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
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

  const isEnvelopeDeleteEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).documentDeleted;

  if (!isEnvelopeDeleteEmailEnabled) {
    return deletedEnvelope;
  }

  // Send cancellation emails to recipients.
  await Promise.all(
    envelope.recipients.map(async (recipient) => {
      if (recipient.sendStatus !== SendStatus.SENT) {
        return;
      }

      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

      const template = createElement(DocumentCancelTemplate, {
        documentName: envelope.title,
        inviterName: user.name || undefined,
        inviterEmail: user.email,
        assetBaseUrl,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang: emailLanguage, branding }),
        renderEmailWithI18N(template, {
          lang: emailLanguage,
          branding,
          plainText: true,
        }),
      ]);

      const i18n = await getI18nInstance(emailLanguage);

      await mailer.sendMail({
        to: {
          address: recipient.email,
          name: recipient.name,
        },
        from: senderEmail,
        replyTo: replyToEmail,
        subject: i18n._(msg`Document Cancelled`),
        html,
        text,
      });
    }),
  );

  return deletedEnvelope;
};
