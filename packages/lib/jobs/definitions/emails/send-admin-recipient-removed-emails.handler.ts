import RecipientRemovedByAdminEmailTemplate from '@documenso/email/templates/recipient-removed-by-admin';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { assertOrganisationRatesAndLimits } from '../../../server-only/rate-limit/assert-organisation-rates-and-limits';
import { isRecipientEmailValidForSending } from '../../../utils/recipients';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendAdminRecipientRemovedEmailsJobDefinition } from './send-admin-recipient-removed-emails';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendAdminRecipientRemovedEmailsJobDefinition;
  io: JobRunIO;
}) => {
  const { envelopeId, recipientEmail, recipientName, notifyRecipient } = payload;

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
    },
    include: {
      documentMeta: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  // Envelope may have been deleted since enqueueing, don't retry forever.
  if (!envelope) {
    return;
  }

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const shouldNotifyRecipient = notifyRecipient && isRecipientEmailValidForSending({ email: recipientEmail });

  // The document's `recipientRemoved` email preference is intentionally ignored
  // for admin removals. Organisation email disabling and limits still apply.
  if (shouldNotifyRecipient) {
    const {
      branding,
      emailLanguage,
      senderEmail,
      replyToEmail,
      organisationId,
      claims,
      emailsDisabled,
      emailTransport,
    } = await getEmailContext({
      emailType: 'RECIPIENT',
      source: {
        type: 'team',
        teamId: envelope.teamId,
      },
      meta: envelope.documentMeta,
    });

    let isWithinEmailLimits = !emailsDisabled;

    if (isWithinEmailLimits) {
      try {
        await assertOrganisationRatesAndLimits({
          organisationId,
          organisationClaim: claims,
          type: 'email',
          count: 1,
        });
      } catch (_err) {
        io.logger.warn({
          msg: 'Admin recipient removed email dropped: org email limit exceeded',
          organisationId,
          envelopeId: envelope.id,
        });

        isWithinEmailLimits = false;
      }
    }

    if (isWithinEmailLimits) {
      const template = createElement(RecipientRemovedByAdminEmailTemplate, {
        audience: 'recipient',
        documentName: envelope.title,
        recipientName,
        recipientEmail,
        assetBaseUrl,
      });

      const i18n = await getI18nInstance(emailLanguage);

      await io.runTask('send-admin-recipient-removed-email-recipient', async () => {
        const [html, text] = await Promise.all([
          renderEmailWithI18N(template, { lang: emailLanguage, branding }),
          renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
        ]);

        await emailTransport.sendMail({
          to: {
            address: recipientEmail,
            name: recipientName,
          },
          from: senderEmail,
          replyTo: replyToEmail,
          subject: i18n._(msg`You have been removed from a document`),
          html,
          text,
        });
      });
    }
  }

  const ownerEmail = envelope.user.email;

  if (!isRecipientEmailValidForSending({ email: ownerEmail })) {
    return;
  }

  const { branding, emailLanguage, senderEmail, emailTransport } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  const ownerTemplate = createElement(RecipientRemovedByAdminEmailTemplate, {
    audience: 'owner',
    documentName: envelope.title,
    recipientName,
    recipientEmail,
    assetBaseUrl,
  });

  const ownerI18n = await getI18nInstance(emailLanguage);

  await io.runTask('send-admin-recipient-removed-email-owner', async () => {
    const [html, text] = await Promise.all([
      renderEmailWithI18N(ownerTemplate, { lang: emailLanguage, branding }),
      renderEmailWithI18N(ownerTemplate, { lang: emailLanguage, branding, plainText: true }),
    ]);

    await emailTransport.sendMail({
      to: {
        address: ownerEmail,
        name: envelope.user.name || '',
      },
      from: senderEmail,
      subject: ownerI18n._(msg`A recipient has been removed from your document`),
      html,
      text,
    });
  });
};
