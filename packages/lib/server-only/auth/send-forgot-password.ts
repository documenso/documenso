import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { ForgotPasswordTemplate } from '@documenso/email/templates/forgot-password';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendForgotPasswordOptions {
  userId: number;
}

export const sendForgotPassword = async ({ userId }: SendForgotPasswordOptions) => {
  let user;

  try {
    user = await prisma.user.findFirst({
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
  } catch (error) {
    throw error;
  }

  if (!user) {
    return;
  }

  const token = user.passwordResetTokens?.[0]?.token;

  if (!token) {
    return;
  }

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const resetPasswordLink = `${assetBaseUrl}/reset-password/${token}`;

  const template = createElement(ForgotPasswordTemplate, {
    assetBaseUrl,
    resetPasswordLink,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  return await mailer.sendMail({
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