import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { DocumentSource } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { DocumentCreatedFromDirectTemplateEmailTemplate } from '@documenso/email/templates/document-created-from-direct-template';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../../utils/teams';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDirectTemplateCreatedEmailJobDefinition } from './send-direct-template-created-email';

export const run = async ({
  payload,
}: {
  payload: TSendDirectTemplateCreatedEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { envelopeId, teamId, directRecipientId } = payload;

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      source: DocumentSource.TEMPLATE_DIRECT_LINK,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      documentMeta: true,
      team: {
        select: {
          url: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  const directRecipient = await prisma.recipient.findFirst({
    where: {
      id: directRecipientId,
      envelopeId,
    },
  });

  if (!directRecipient) {
    throw new Error('Direct recipient not found on envelope');
  }

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId,
    },
    meta: envelope.documentMeta,
  });

  const templateOwner = envelope.user;

  const documentLink = `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(envelope.team?.url)}/${
    envelope.id
  }`;

  const emailTemplate = createElement(DocumentCreatedFromDirectTemplateEmailTemplate, {
    recipientName: directRecipient.email,
    recipientRole: directRecipient.role,
    documentLink,
    documentName: envelope.title,
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000',
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailTemplate, { lang: emailLanguage, branding }),
    renderEmailWithI18N(emailTemplate, { lang: emailLanguage, branding, plainText: true }),
  ]);

  const i18n = await getI18nInstance(emailLanguage);

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
