import { createElement } from 'react';

import { msg } from '@lingui/macro';
import { z } from 'zod';

import { mailer } from '@documenso/email/mailer';
import { DocumentRecipientSignedEmailTemplate } from '@documenso/email/templates/document-recipient-signed';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../../utils/team-global-settings-to-branding';
import { type JobDefinition } from '../../client/_internal/job';

const SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION_ID = 'send.recipient.signed.email';

const SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  documentId: z.number(),
  recipientId: z.number(),
});

export const SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION = {
  id: SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Recipient Signed Email',
  version: '1.0.0',
  trigger: {
    name: SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const { documentId, recipientId } = payload;

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
        User: true,
        documentMeta: true,
        team: {
          include: {
            teamGlobalSettings: true,
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.Recipient.length === 0) {
      throw new Error('Document has no recipients');
    }

    const isRecipientSignedEmailEnabled = extractDerivedDocumentEmailSettings(
      document.documentMeta,
    ).recipientSigned;

    if (!isRecipientSignedEmailEnabled) {
      return;
    }

    const [recipient] = document.Recipient;
    const { email: recipientEmail, name: recipientName } = recipient;
    const { User: owner } = document;

    const recipientReference = recipientName || recipientEmail;

    // Don't send notification if the owner is the one who signed
    if (owner.email === recipientEmail) {
      return;
    }

    const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
    const i18n = await getI18nInstance(document.documentMeta?.language);

    const template = createElement(DocumentRecipientSignedEmailTemplate, {
      documentName: document.title,
      recipientName,
      recipientEmail,
      assetBaseUrl,
    });

    await io.runTask('send-recipient-signed-email', async () => {
      const branding = document.team?.teamGlobalSettings
        ? teamGlobalSettingsToBranding(document.team.teamGlobalSettings)
        : undefined;

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang: document.documentMeta?.language, branding }),
        renderEmailWithI18N(template, {
          lang: document.documentMeta?.language,
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
  },
} as const satisfies JobDefinition<
  typeof SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION_ID,
  z.infer<typeof SEND_RECIPIENT_SIGNED_EMAIL_JOB_DEFINITION_SCHEMA>
>;
