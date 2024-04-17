import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentPendingEmailTemplate } from '@documenso/email/templates/document-pending';
import { prisma } from '@documenso/prisma';

export interface SendPendingEmailOptions {
  documentId: number;
  recipientId: number;
}

export const sendPendingEmail = async ({ documentId, recipientId }: SendPendingEmailOptions) => {
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
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  const [recipient] = document.Recipient;

  const { email, name } = recipient;

  const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';

  const template = createElement(DocumentPendingEmailTemplate, {
    documentName: document.title,
    assetBaseUrl,
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
    subject: 'Waiting for others to complete signing.',
    html: render(template),
    text: render(template, { plainText: true }),
  });
};
