import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentSuperDeleteEmailTemplate } from '@documenso/email/templates/document-super-delete';
import { prisma } from '@documenso/prisma';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';

export interface SendDeleteEmailOptions {
  documentId: number;
  reason: string;
}

export const sendDeleteEmail = async ({ documentId, reason }: SendDeleteEmailOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
    },
    include: {
      User: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const { email, name } = document.User;

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const template = createElement(DocumentSuperDeleteEmailTemplate, {
    documentName: document.title,
    reason,
    assetBaseUrl,
  });

  await mailer.sendMail({
    to: {
      address: email,
      name: name || '',
    },
    from: {
      name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
      address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
    },
    subject: 'Document Deleted!',
    html: render(template),
    text: render(template, { plainText: true }),
  });
};
