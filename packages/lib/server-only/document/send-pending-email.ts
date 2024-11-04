import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentPendingEmailTemplate } from '@documenso/email/templates/document-pending';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

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
      documentMeta: true,
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

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const template = createElement(DocumentPendingEmailTemplate, {
    documentName: document.title,
    assetBaseUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang: document.documentMeta?.language }),
    renderEmailWithI18N(template, { lang: document.documentMeta?.language, plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  await mailer.sendMail({
    to: {
      address: email,
      name,
    },
    from: {
      name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
      address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
    },
    subject: i18n._(msg`Waiting for others to complete signing.`),
    html,
    text,
  });
};
