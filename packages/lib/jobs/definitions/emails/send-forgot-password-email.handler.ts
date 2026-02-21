import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { ForgotPasswordTemplate } from '@documenso/email/templates/forgot-password';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { env } from '../../../utils/env';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendForgotPasswordEmailJobDefinition } from './send-forgot-password-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendForgotPasswordEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { userId } = payload;

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      passwordResetTokens: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (user.passwordResetTokens.length === 0) {
    throw new Error('No password reset token found for user');
  }

  const token = user.passwordResetTokens[0].token;
  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const resetPasswordLink = `${NEXT_PUBLIC_WEBAPP_URL()}/reset-password/${token}`;

  const template = createElement(ForgotPasswordTemplate, {
    assetBaseUrl,
    resetPasswordLink,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  await mailer.sendMail({
    to: {
      address: user.email,
      name: user.name || '',
    },
    from: {
      name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso',
      address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com',
    },
    subject: i18n._(msg`Forgot Password?`),
    html,
    text,
  });
};
