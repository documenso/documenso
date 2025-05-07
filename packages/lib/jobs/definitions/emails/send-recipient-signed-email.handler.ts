import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentRecipientSignedEmailTemplate } from '@documenso/email/templates/document-recipient-signed';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { getTeamSettings } from '../../../server-only/team/get-team-settings';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../../utils/team-global-settings-to-branding';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendRecipientSignedEmailJobDefinition } from './send-recipient-signed-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendRecipientSignedEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, recipientId } = payload;

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      recipients: {
        some: {
          id: recipientId,
        },
      },
    },
    include: {
      recipients: {
        where: {
          id: recipientId,
        },
      },
      user: true,
      documentMeta: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  const isRecipientSignedEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientSigned;

  if (!isRecipientSignedEmailEnabled) {
    return;
  }

  const [recipient] = document.recipients;
  const { email: recipientEmail, name: recipientName } = recipient;
  const { user: owner } = document;

  const recipientReference = recipientName || recipientEmail;

  // Don't send notification if the owner is the one who signed
  if (owner.email === recipientEmail) {
    return;
  }

  const settings = await getTeamSettings({
    userId: owner.id,
    teamId: document.teamId,
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const branding = teamGlobalSettingsToBranding(settings, document.teamId);

  const lang = document.documentMeta?.language ?? settings.documentLanguage;
  const i18n = await getI18nInstance(lang);

  const template = createElement(DocumentRecipientSignedEmailTemplate, {
    documentName: document.title,
    recipientName,
    recipientEmail,
    assetBaseUrl,
  });

  await io.runTask('send-recipient-signed-email', async () => {
    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang, branding }),
      renderEmailWithI18N(template, {
        lang,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        name: owner.name ?? '',
        address: owner.email,
      },
      from: {
        name: FROM_NAME,
        address: FROM_ADDRESS,
      },
      subject: i18n._(msg`${recipientReference} has signed "${document.title}"`),
      html,
      text,
    });
  });
};
