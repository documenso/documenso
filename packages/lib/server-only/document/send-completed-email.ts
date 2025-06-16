import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { DocumentSource } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { DocumentCompletedEmailTemplate } from '@documenso/email/templates/document-completed';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { env } from '../../utils/env';
import { renderCustomEmailTemplate } from '../../utils/render-custom-email-template';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../utils/teams';
import { getEmailContext } from '../email/get-email-context';

export interface SendDocumentOptions {
  documentId: number;
  requestMetadata?: RequestMetadata;
}

export const sendCompletedEmail = async ({ documentId, requestMetadata }: SendDocumentOptions) => {
  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
    },
    include: {
      documentData: true,
      documentMeta: true,
      recipients: true,
      user: true,
      team: {
        select: {
          id: true,
          url: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const isDirectTemplate = document?.source === DocumentSource.TEMPLATE_DIRECT_LINK;

  if (document.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'team',
      teamId: document.teamId,
    },
  });

  const { user: owner } = document;

  const completedDocument = await getFileServerSide(document.documentData);

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  let documentOwnerDownloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(
    document.team?.url,
  )}/${document.id}`;

  if (document.team?.url) {
    documentOwnerDownloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}/t/${document.team.url}/documents/${
      document.id
    }`;
  }

  const emailSettings = extractDerivedDocumentEmailSettings(document.documentMeta);
  const isDocumentCompletedEmailEnabled = emailSettings.documentCompleted;
  const isOwnerDocumentCompletedEmailEnabled = emailSettings.ownerDocumentCompleted;

  // Send email to document owner if:
  // 1. Owner document completed emails are enabled AND
  // 2. Either:
  //    - The owner is not a recipient, OR
  //    - Recipient emails are disabled
  if (
    isOwnerDocumentCompletedEmailEnabled &&
    (!document.recipients.find((recipient) => recipient.email === owner.email) ||
      !isDocumentCompletedEmailEnabled)
  ) {
    const template = createElement(DocumentCompletedEmailTemplate, {
      documentName: document.title,
      assetBaseUrl,
      downloadLink: documentOwnerDownloadLink,
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
      to: [
        {
          name: owner.name || '',
          address: owner.email,
        },
      ],
      from: {
        name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso',
        address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com',
      },
      subject: i18n._(msg`Signing Complete!`),
      html,
      text,
      attachments: [
        {
          filename: document.title.endsWith('.pdf') ? document.title : document.title + '.pdf',
          content: Buffer.from(completedDocument),
        },
      ],
    });

    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
        documentId: document.id,
        user: null,
        requestMetadata,
        data: {
          emailType: 'DOCUMENT_COMPLETED',
          recipientEmail: owner.email,
          recipientName: owner.name ?? '',
          recipientId: owner.id,
          recipientRole: 'OWNER',
          isResending: false,
        },
      }),
    });
  }

  if (!isDocumentCompletedEmailEnabled) {
    return;
  }

  await Promise.all(
    document.recipients.map(async (recipient) => {
      const customEmailTemplate = {
        'signer.name': recipient.name,
        'signer.email': recipient.email,
        'document.name': document.title,
      };

      const downloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}/complete`;

      const template = createElement(DocumentCompletedEmailTemplate, {
        documentName: document.title,
        assetBaseUrl,
        downloadLink: recipient.email === owner.email ? documentOwnerDownloadLink : downloadLink,
        customBody:
          isDirectTemplate && document.documentMeta?.message
            ? renderCustomEmailTemplate(document.documentMeta.message, customEmailTemplate)
            : undefined,
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
        to: [
          {
            name: recipient.name,
            address: recipient.email,
          },
        ],
        from: {
          name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso',
          address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com',
        },
        subject:
          isDirectTemplate && document.documentMeta?.subject
            ? renderCustomEmailTemplate(document.documentMeta.subject, customEmailTemplate)
            : i18n._(msg`Signing Complete!`),
        html,
        text,
        attachments: [
          {
            filename: document.title.endsWith('.pdf') ? document.title : document.title + '.pdf',
            content: Buffer.from(completedDocument),
          },
        ],
      });

      await prisma.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
          documentId: document.id,
          user: null,
          requestMetadata,
          data: {
            emailType: 'DOCUMENT_COMPLETED',
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            recipientId: recipient.id,
            recipientRole: recipient.role,
            isResending: false,
          },
        }),
      });
    }),
  );
};
