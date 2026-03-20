import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { RecipientExpiredTemplate } from '@documenso/email/templates/recipient-expired';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../../utils/teams';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendOwnerRecipientExpiredEmailJobDefinition } from './send-owner-recipient-expired-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendOwnerRecipientExpiredEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { recipientId, envelopeId } = payload;

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
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
      team: {
        select: {
          teamEmail: true,
          name: true,
          url: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new Error(`Envelope ${envelopeId} not found`);
  }

  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      envelopeId,
    },
  });

  if (!recipient) {
    throw new Error(`Recipient ${recipientId} not found on envelope ${envelopeId}`);
  }

  const { documentMeta, user: documentOwner } = envelope;

  const isEmailEnabled = extractDerivedDocumentEmailSettings(documentMeta).ownerRecipientExpired;

  if (!isEmailEnabled) {
    return;
  }

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: documentMeta,
  });

  const i18n = await getI18nInstance(emailLanguage);

  const documentLink = `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(envelope.team.url)}/${envelope.id}`;

  const template = createElement(RecipientExpiredTemplate, {
    documentName: envelope.title,
    recipientName: recipient.name || recipient.email,
    recipientEmail: recipient.email,
    documentLink,
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
  });

  await io.runTask('send-owner-recipient-expired-email', async () => {
    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang: emailLanguage, branding }),
      renderEmailWithI18N(template, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        name: documentOwner.name || '',
        address: documentOwner.email,
      },
      from: senderEmail,
      subject: i18n._(
        msg`Signing window expired for "${recipient.name || recipient.email}" on "${envelope.title}"`,
      ),
      html,
      text,
    });
  });
};
