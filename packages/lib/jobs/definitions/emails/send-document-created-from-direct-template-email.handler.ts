import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentCreatedFromDirectTemplateEmailTemplate } from '@documenso/email/templates/document-created-from-direct-template';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../../utils/teams';
import type { TSendDocumentCreatedFromDirectTemplateEmailJobDefinition } from './send-document-created-from-direct-template-email';

export const run = async ({
  payload,
}: {
  payload: TSendDocumentCreatedFromDirectTemplateEmailJobDefinition;
}) => {
  const { envelopeId, recipientId } = payload;

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
    },
    include: {
      recipients: {
        where: {
          id: recipientId,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      team: {
        select: {
          url: true,
        },
      },
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new Error('Envelope not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Recipient not found');
  }

  const [recipient] = envelope.recipients;
  const { user: templateOwner } = envelope;

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const documentLink = `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(envelope.team?.url ?? '')}/${envelope.id}`;

  const emailTemplate = createElement(DocumentCreatedFromDirectTemplateEmailTemplate, {
    recipientName: recipient.email,
    recipientRole: recipient.role,
    documentLink,
    documentName: envelope.title,
    assetBaseUrl,
  });

  const i18n = await getI18nInstance(emailLanguage);

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailTemplate, { lang: emailLanguage, branding }),
    renderEmailWithI18N(emailTemplate, { lang: emailLanguage, branding, plainText: true }),
  ]);

  await mailer.sendMail({
    to: [
      {
        name: templateOwner.name || '',
        address: templateOwner.email,
      },
    ],
    from: senderEmail,
    subject: i18n._(msg`Document created from direct template`),
    html,
    text,
  });
};
