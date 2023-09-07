import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentPendingEmailTemplate } from '@documenso/email/templates/document-pending';
import { Document, Recipient } from '@documenso/prisma/client';

export interface SendPendingEmailOptions {
  document: Document;
  recipient: Recipient;
}

export const sendPendingEmail = async ({ document, recipient }: SendPendingEmailOptions) => {
  const { email, name } = recipient;

  const assetBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
    subject: 'You are done signing.',
    html: render(template),
    text: render(template, { plainText: true }),
  });
};
