import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import crypto from 'crypto';

import { mailer } from '@documenso/email/mailer';
import { AdminUserWelcomeTemplate } from '@documenso/email/templates/admin-user-welcome';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../constants/email';
import { ONE_DAY } from '../../constants/time';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendAdminUserWelcomeEmailOptions {
  userId: number;
  organisationName: string;
}

/**
 * Send welcome email for admin-created users with password reset link.
 *
 * Creates a password reset token and sends an email explaining:
 * - An administrator created their account
 * - They need to set their password
 * - The organization they've been added to
 * - Support contact if they didn't expect this
 */
export const sendAdminUserWelcomeEmail = async ({
  userId,
  organisationName,
}: SendAdminUserWelcomeEmailOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const token = crypto.randomBytes(18).toString('hex');

  await prisma.passwordResetToken.create({
    data: {
      token,
      expiry: new Date(Date.now() + ONE_DAY),
      userId: user.id,
    },
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const resetPasswordLink = `${assetBaseUrl}/reset-password/${token}`;

  const emailTemplate = createElement(AdminUserWelcomeTemplate, {
    assetBaseUrl,
    resetPasswordLink,
    organisationName,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(emailTemplate),
    renderEmailWithI18N(emailTemplate, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  return mailer.sendMail({
    to: {
      address: user.email,
      name: user.name || '',
    },
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject: i18n._(msg`Welcome to ${organisationName} on Documenso`),
    html,
    text,
  });
};
