import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { ResetPasswordTemplate } from '@documenso/email/templates/reset-password';
import { prisma } from '@documenso/prisma';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';

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

  return await mailer.sendMail({
    to: {
      address: user.email,
      name: user.name || '',
    },
    from: {
      name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
      address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
    },
    subject: 'Password Reset Success!',
    html: render(template),
    text: render(template, { plainText: true }),
  });
};
