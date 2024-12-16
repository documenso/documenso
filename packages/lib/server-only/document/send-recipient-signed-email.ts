import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentRecipientSignedEmailTemplate } from '@documenso/email/templates/document-recipient-signed';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

export interface SendRecipientSignedEmailOptions {
  documentId: number;
  recipientId: number;
  requestMetadata?: RequestMetadata;
}

export const sendRecipientSignedEmail = async ({
  documentId,
  recipientId,
  requestMetadata,
}: SendRecipientSignedEmailOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      Recipient: {
        some: {
          id: recipientId,
        },
      },
    },
    include: {
      Recipient: {
        where: {
          id: recipientId,
        },
      },
      User: true,
      documentMeta: true,
      team: {
        include: {
          teamGlobalSettings: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  const isRecipientSignedEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientSigned;

  if (!isRecipientSignedEmailEnabled) {
    return;
  }

  const [recipient] = document.Recipient;
  const { email: recipientEmail, name: recipientName } = recipient;
  const { User: owner } = document;

  // Don't send notification if the owner is the one who signed
  if (owner.email === recipientEmail) {
    return;
  }

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const i18n = await getI18nInstance(document.documentMeta?.language);
  const branding = document.team?.teamGlobalSettings
    ? teamGlobalSettingsToBranding(document.team.teamGlobalSettings)
    : undefined;

  const template = createElement(DocumentRecipientSignedEmailTemplate, {
    documentName: document.title,
    recipientName,
    recipientEmail,
    assetBaseUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang: document.documentMeta?.language, branding }),
    renderEmailWithI18N(template, {
      lang: document.documentMeta?.language,
      branding,
      plainText: true,
    }),
  ]);

  await mailer.sendMail({
    to: {
      address: owner.email,
      name: owner.name || '',
    },
    from: {
      name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
      address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
    },
    subject: i18n._(
      msg`${recipientName ? recipientName : recipientEmail} has signed "${document.title}"`,
    ),
    html,
    text,
  });

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      documentId: document.id,
      user: null,
      requestMetadata,
      data: {
        emailType: 'RECIPIENT_SIGNED',
        recipientEmail,
        recipientName,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        isResending: false,
      },
    }),
  });
};
