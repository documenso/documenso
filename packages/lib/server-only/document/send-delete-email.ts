import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentSuperDeleteEmailTemplate } from '@documenso/email/templates/document-super-delete';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { env } from '../../utils/env';
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
      user: true,
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

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'team',
      teamId: document.teamId,
    },
  });

  const { email, name } = document.user;

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const template = createElement(DocumentSuperDeleteEmailTemplate, {
    documentName: document.title,
    reason,
    assetBaseUrl,
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
    to: {
      address: email,
      name: name || '',
    },
    from: {
      name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso',
      address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com',
    },
    subject: i18n._(msg`Document Deleted!`),
    html,
    text,
  });
};
