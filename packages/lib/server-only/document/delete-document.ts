import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Document, DocumentMeta, Recipient, User } from '@prisma/client';
import { DocumentStatus, SendStatus, WebhookTriggerEvents } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { isDocumentCompleted } from '../../utils/document';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';
import { getMemberRoles } from '../team/get-member-roles';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type DeleteDocumentOptions = {
  id: number;
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

  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  if (!document || (teamId !== undefined && teamId !== document.teamId)) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const isUserTeamMember = await getMemberRoles({
    teamId: document.teamId,
    reference: {
      type: 'User',
      id: userId,
    },
  })
    .then(() => true)
    .catch(() => false);

  const isUserOwner = document.userId === userId;
  const userRecipient = document.recipients.find((recipient) => recipient.email === user.email);

  if (!isUserOwner && !isUserTeamMember && !userRecipient) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Not allowed',
    });
  }

  // Handle hard or soft deleting the actual document if user has permission.
  if (isUserOwner || isUserTeamMember) {
    await handleDocumentOwnerDelete({
      document,
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
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(document)),
    userId,
    teamId,
  });

  // Return partial document for API v1 response.
  return {
    id: document.id,
    userId: document.userId,
    teamId: document.teamId,
    title: document.title,
    status: document.status,
    documentDataId: document.documentDataId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    completedAt: document.completedAt,
  };
};

type HandleDocumentOwnerDeleteOptions = {
  document: Document & {
    recipients: Recipient[];
    documentMeta: DocumentMeta | null;
  };
  user: User;
  requestMetadata: ApiRequestMetadata;
};

const handleDocumentOwnerDelete = async ({
  document,
  user,
  requestMetadata,
}: HandleDocumentOwnerDeleteOptions) => {
  if (document.deletedAt) {
    return;
  }

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'team',
      teamId: document.teamId,
    },
  });

  // Soft delete completed documents.
  if (isDocumentCompleted(document.status)) {
    return await prisma.$transaction(async (tx) => {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          documentId: document.id,
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
          metadata: requestMetadata,
          data: {
            type: 'SOFT',
          },
        }),
      });

      return await tx.document.update({
        where: {
          id: document.id,
        },
        data: {
          deletedAt: new Date().toISOString(),
        },
      });
    });
  }

  // Hard delete draft and pending documents.
  const deletedDocument = await prisma.$transaction(async (tx) => {
    // Currently redundant since deleting a document will delete the audit logs.
    // However may be useful if we disassociate audit logs and documents if required.
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId: document.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        metadata: requestMetadata,
        data: {
          type: 'HARD',
        },
      }),
    });

    return await tx.document.delete({
      where: {
        id: document.id,
        status: {
          not: DocumentStatus.COMPLETED,
        },
      },
    });
  });

  const isDocumentDeleteEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).documentDeleted;

  if (!isDocumentDeleteEmailEnabled) {
    return deletedDocument;
  }

  // Send cancellation emails to recipients.
  await Promise.all(
    document.recipients.map(async (recipient) => {
      if (recipient.sendStatus !== SendStatus.SENT) {
        return;
      }

      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

      const template = createElement(DocumentCancelTemplate, {
        documentName: document.title,
        inviterName: user.name || undefined,
        inviterEmail: user.email,
        assetBaseUrl,
      });

      const lang = document.documentMeta?.language ?? settings.documentLanguage;

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang, branding }),
        renderEmailWithI18N(template, {
          lang,
          branding,
          plainText: true,
        }),
      ]);

      const i18n = await getI18nInstance(lang);

      await mailer.sendMail({
        to: {
          address: recipient.email,
          name: recipient.name,
        },
        from: {
          name: FROM_NAME,
          address: FROM_ADDRESS,
        },
        subject: i18n._(msg`Document Cancelled`),
        html,
        text,
      });
    }),
  );

  return deletedDocument;
};
