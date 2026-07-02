import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { isRecipientEmailValidForSending } from '../../../utils/recipients';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDocumentDeletedEmailsJobDefinition } from './send-document-deleted-emails';

export const run = async ({ payload, io }: { payload: TSendDocumentDeletedEmailsJobDefinition; io: JobRunIO }) => {
  const { teamId, documentName, inviterName, inviterEmail, meta, recipients } = payload;

  if (recipients.length === 0) {
    return;
  }

  const { branding, emailLanguage, senderEmail, replyToEmail, emailsDisabled, emailTransport } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId,
    },
    meta,
  });

  // Don't send cancellation emails if the organisation has email sending
  // disabled. Re-checked here (not just at enqueue time) because the org can be
  // disabled between the delete request and this job running.
  if (emailsDisabled) {
    return;
  }

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const i18n = await getI18nInstance(emailLanguage);

  for (const recipient of recipients) {
    await io.runTask(`send-document-deleted-emails-${recipient.email}`, async () => {
      if (!isRecipientEmailValidForSending(recipient)) {
        return;
      }

      const template = createElement(DocumentCancelTemplate, {
        documentName,
        inviterName: inviterName || undefined,
        inviterEmail,
        assetBaseUrl,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang: emailLanguage, branding }),
        renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
      ]);

      await emailTransport.sendMail({
        to: {
          address: recipient.email,
          name: recipient.name,
        },
        from: senderEmail,
        replyTo: replyToEmail,
        subject: i18n._(msg`Document Cancelled`),
        html,
        text,
      });
    });
  }
};
