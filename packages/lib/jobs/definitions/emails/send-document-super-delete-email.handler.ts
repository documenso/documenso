import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentSuperDeleteEmailTemplate } from '@documenso/email/templates/document-super-delete';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDocumentSuperDeleteEmailJobDefinition } from './send-document-super-delete-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendDocumentSuperDeleteEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { userId, documentTitle, reason, teamId } = payload;

  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const { branding, senderEmail, emailLanguage } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId,
    },
    meta: null,
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const template = createElement(DocumentSuperDeleteEmailTemplate, {
    documentName: documentTitle,
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
      address: user.email,
      name: user.name || '',
    },
    from: senderEmail,
    subject: i18n._(msg`Document Deleted!`),
    html,
    text,
  });
};
