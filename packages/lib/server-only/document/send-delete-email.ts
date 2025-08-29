import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentSuperDeleteEmailTemplate } from '@documenso/email/templates/document-super-delete';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';

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
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      documentMeta: true,
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const isDocumentDeletedEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).documentDeleted;

  if (!isDocumentDeletedEmailEnabled) {
    return;
  }

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'team',
      teamId: document.teamId,
    },
    meta: document.documentMeta,
  });

  const { email, name } = document.user;

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const template = createElement(DocumentSuperDeleteEmailTemplate, {
    documentName: document.title,
    reason,
    assetBaseUrl,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang: emailLanguage, branding }),
    renderEmailWithI18N(template, {
      lang: emailLanguage,
      branding,
      plainText: true,
    }),
  ]);

  const i18n = await getI18nInstance(emailLanguage);

  await mailer.sendMail({
    to: {
      address: email,
      name: name || '',
    },
    from: senderEmail,
    subject: i18n._(msg`Document Deleted!`),
    html,
    text,
  });
};
