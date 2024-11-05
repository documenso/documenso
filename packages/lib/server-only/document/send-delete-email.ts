import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentSuperDeleteEmailTemplate } from '@documenso/email/templates/document-super-delete';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

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

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  await mailer.sendMail({
    to: {
      address: email,
      name: name || '',
    },
    from: {
      name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
      address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
    },
    subject: i18n._(msg`Document Deleted!`),
    html,
    text,
  });
};
