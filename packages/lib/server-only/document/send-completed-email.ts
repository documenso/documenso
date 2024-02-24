import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentCompletedEmailTemplate } from '@documenso/email/templates/document-completed';
import { prisma } from '@documenso/prisma';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getFile } from '../../universal/upload/get-file';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

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
      Recipient: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  const buffer = await getFile(document.documentData);

  await Promise.all(
    document.Recipient.map(async (recipient) => {
      const { email, name, token } = recipient;

      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

      const template = createElement(DocumentCompletedEmailTemplate, {
        documentName: document.title,
        assetBaseUrl,
        downloadLink: `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${token}/complete`,
      });

      await prisma.$transaction(
        async (tx) => {
          await mailer.sendMail({
            to: {
              address: email,
              name,
            },
            from: {
              name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
              address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
            },
            subject: 'Signing Complete!',
            html: render(template),
            text: render(template, { plainText: true }),
            attachments: [
              {
                filename: document.title,
                content: Buffer.from(buffer),
              },
            ],
          });

          await tx.documentAuditLog.create({
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
        },
        { timeout: 30_000 },
      );
    }),
  );
};
