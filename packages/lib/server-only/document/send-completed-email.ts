import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentCompletedEmailTemplate } from '@documenso/email/templates/document-completed';
import { prisma } from '@documenso/prisma';
import { DocumentSource } from '@documenso/prisma/client';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getFile } from '../../universal/upload/get-file';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { renderCustomEmailTemplate } from '../../utils/render-custom-email-template';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';
import { formatDocumentsPath } from '../../utils/teams';

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
      Recipient: true,
      User: true,
      team: {
        select: {
          id: true,
          url: true,
          teamGlobalSettings: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const isDirectTemplate = document?.source === DocumentSource.TEMPLATE_DIRECT_LINK;

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  const { User: owner } = document;

  const completedDocument = await getFile(document.documentData);

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  let documentOwnerDownloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(
    document.team?.url,
  )}/${document.id}`;

  if (document.team?.url) {
    documentOwnerDownloadLink = `${NEXT_PUBLIC_WEBAPP_URL()}/t/${document.team.url}/documents/${
      document.id
    }`;
  }

  const i18n = await getI18nInstance(document.documentMeta?.language);

  const isDocumentCompletedEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).documentCompleted;

  // If the document owner is not a recipient, OR recipient emails are disabled, then send the email to them separately.
  if (
    !document.Recipient.find((recipient) => recipient.email === owner.email) ||
    !isDocumentCompletedEmailEnabled
  ) {
    const template = createElement(DocumentCompletedEmailTemplate, {
      documentName: document.title,
      assetBaseUrl,
      downloadLink: documentOwnerDownloadLink,
    });

    const branding = document.team?.teamGlobalSettings
      ? teamGlobalSettingsToBranding(document.team.teamGlobalSettings)
      : undefined;

    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang: document.documentMeta?.language, branding }),
      renderEmailWithI18N(template, {
        lang: document.documentMeta?.language,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: [
        {
          name: owner.name || '',
          address: owner.email,
        },
      ],
      from: {
        name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
        address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
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
    document.Recipient.map(async (recipient) => {
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

      const branding = document.team?.teamGlobalSettings
        ? teamGlobalSettingsToBranding(document.team.teamGlobalSettings)
        : undefined;

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang: document.documentMeta?.language, branding }),
        renderEmailWithI18N(template, {
          lang: document.documentMeta?.language,
          branding,
          plainText: true,
        }),
      ]);

      await mailer.sendMail({
        to: [
          {
            name: recipient.name,
            address: recipient.email,
          },
        ],
        from: {
          name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
          address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
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
