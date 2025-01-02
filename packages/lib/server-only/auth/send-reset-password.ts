import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { ResetPasswordTemplate } from '@documenso/email/templates/reset-password';
import { prisma } from '@documenso/prisma';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendResetPasswordOptions {
  userId: number;
}

export const sendResetPassword = async ({ userId }: SendResetPasswordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const template = createElement(ResetPasswordTemplate, {
    assetBaseUrl,
    userEmail: user.email,
    userName: user.name || '',
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  return await mailer.sendMail({
    to: {
      address: user.email,
      name: user.name || '',
    },
    from: {
      name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso',
      address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com',
    },
    subject: 'Password Reset Success!',
    html,
    text,
  });
};
