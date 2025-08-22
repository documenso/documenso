import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { SendStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import RecipientRemovedFromDocumentTemplate from '@documenso/email/templates/recipient-removed-from-document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEmailContext } from '../email/get-email-context';

export interface DeleteDocumentRecipientOptions {
  userId: number;
  teamId: number;
  recipientId: number;
  requestMetadata: ApiRequestMetadata;
}

export const deleteDocumentRecipient = async ({
  userId,
  teamId,
  recipientId,
  requestMetadata,
}: DeleteDocumentRecipientOptions): Promise<void> => {
  const document = await prisma.document.findFirst({
    where: {
      recipients: {
        some: {
          id: recipientId,
        },
      },
      team: buildTeamWhereQuery({ teamId, userId }),
    },
    include: {
      documentMeta: true,
      team: true,
      recipients: {
        where: {
          id: recipientId,
        },
      },
    },
  });

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (document.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document already complete',
    });
  }

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  const recipientToDelete = document.recipients[0];

  if (!recipientToDelete || recipientToDelete.id !== recipientId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.recipient.delete({
      where: {
        id: recipientId,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED,
        documentId: document.id,
        metadata: requestMetadata,
        data: {
          recipientEmail: recipientToDelete.email,
          recipientName: recipientToDelete.name,
          recipientId: recipientToDelete.id,
          recipientRole: recipientToDelete.role,
        },
      }),
    });
  });

  const isRecipientRemovedEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientRemoved;

  // Send email to deleted recipient.
  if (recipientToDelete.sendStatus === SendStatus.SENT && isRecipientRemovedEmailEnabled) {
    const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

    const template = createElement(RecipientRemovedFromDocumentTemplate, {
      documentName: document.title,
      inviterName: document.team?.name || user.name || undefined,
      assetBaseUrl,
    });

    const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
      emailType: 'RECIPIENT',
      source: {
        type: 'team',
        teamId: document.teamId,
      },
      meta: document.documentMeta,
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang: emailLanguage, branding }),
      renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
    ]);

    const i18n = await getI18nInstance(emailLanguage);

    await mailer.sendMail({
      to: {
        address: recipientToDelete.email,
        name: recipientToDelete.name,
      },
      from: senderEmail,
      replyTo: replyToEmail,
      subject: i18n._(msg`You have been removed from a document`),
      html,
      text,
    });
  }
};
