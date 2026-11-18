import { mailer } from '@documenso/email/mailer';
import { AccountDisabledEmailTemplate } from '@documenso/email/templates/account-disabled';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL, SUPPORT_EMAIL } from '../../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../../constants/email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendAccountDisabledEmailJobDefinition } from './send-account-disabled-email';

/**
 * Sent via the internal mailer rather than the organisation's email context since
 * the organisation's emails are blocked once the owner is disabled.
 */
export const run = async ({ payload, io }: { payload: TSendAccountDisabledEmailJobDefinition; io: JobRunIO }) => {
  const { userId, reason, envelopeId } = payload;

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const i18n = await getI18nInstance();

  await io.runTask('send-account-disabled-user-email', async () => {
    const template = createElement(AccountDisabledEmailTemplate, {
      assetBaseUrl,
      supportEmail: SUPPORT_EMAIL,
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(template),
      renderEmailWithI18N(template, { plainText: true }),
    ]);

    await mailer.sendMail({
      to: {
        address: user.email,
        name: user.name || '',
      },
      from: DOCUMENSO_INTERNAL_EMAIL,
      subject: i18n._(msg`Your Documenso account has been disabled`),
      html,
      text,
    });
  });

  await io.runTask('send-account-disabled-support-email', async () => {
    await mailer.sendMail({
      to: SUPPORT_EMAIL,
      from: DOCUMENSO_INTERNAL_EMAIL,
      subject: i18n._(msg`An account was automatically disabled`),
      text: `
        An account was automatically disabled and the user has been notified.

        Reason: ${reason}
        User ID: ${user.id}
        User Email: ${user.email}
        User Created At: ${user.createdAt.toISOString()}
        Admin URL: ${NEXT_PUBLIC_WEBAPP_URL()}/admin/users/${user.id}
        Reported Envelope ID: ${envelopeId ?? 'Unknown'}
      `,
    });
  });
};
