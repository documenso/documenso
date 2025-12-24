import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { DocumentStatus, SendStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { isRecipientEmailValidForSending } from '../../utils/recipients';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';

export type AdminSuperDeleteDocumentOptions = {
  envelopeId: string;
  requestMetadata?: RequestMetadata;
};

export const adminSuperDeleteDocument = async ({
  envelopeId,
  requestMetadata,
}: AdminSuperDeleteDocumentOptions) => {
  const envelope = await prisma.envelope.findUnique({
    where: {
      id: envelopeId,
    },
    include: {
      recipients: true,
      documentMeta: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const { branding, settings, senderEmail, replyToEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  const { status, user } = envelope;

  const isDocumentDeletedEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).documentDeleted;

  const recipientsToNotify = envelope.recipients.filter((recipient) =>
    isRecipientEmailValidForSending(recipient),
  );

  // if the document is pending, send cancellation emails to all recipients
  if (
    status === DocumentStatus.PENDING &&
    recipientsToNotify.length > 0 &&
    isDocumentDeletedEmailEnabled
  ) {
    await Promise.all(
      recipientsToNotify.map(async (recipient) => {
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

        const lang = envelope.documentMeta?.language ?? settings.documentLanguage;

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
          from: senderEmail,
          replyTo: replyToEmail,
          subject: i18n._(msg`Document Cancelled`),
          html,
          text,
        });
      }),
    );
  }

  // always hard delete if deleted from admin
  return await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        envelopeId,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        user,
        requestMetadata,
        data: {
          type: 'HARD',
        },
      }),
    });

    return await tx.envelope.delete({ where: { id: envelopeId } });
  });
};
