import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentCompletedEmailTemplate } from '@documenso/email/templates/document-completed';
import { prisma } from '@documenso/prisma';

export interface SendDocumentOptions {
  documentId: number;
}

export const sendCompletedEmail = async ({ documentId }: SendDocumentOptions) => {
  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
    },
    include: {
      Recipient: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  await Promise.all([
    document.Recipient.map(async (recipient) => {
      const { email, name } = recipient;

      const assetBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

      const template = createElement(DocumentCompletedEmailTemplate, {
        documentName: document.title,
        assetBaseUrl,
        downloadLink: 'https://documenso.com',
      });

      await mailer.sendMail({
        to: {
          address: email,
          name,
        },
        from: {
          name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
          address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
        },
        subject: 'Everyone has signed!',
        html: render(template),
        text: render(template, { plainText: true }),
      });
    }),
  ]);
};
