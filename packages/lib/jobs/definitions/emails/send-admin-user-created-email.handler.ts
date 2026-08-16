import { mailer } from '@documenso/email/mailer';
import { AdminUserCreatedTemplate } from '@documenso/email/templates/admin-user-created';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import crypto from 'crypto';
import { createElement } from 'react';
import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../../constants/email';
import { ONE_DAY } from '../../../constants/time';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendAdminUserCreatedEmailJobDefinition } from './send-admin-user-created-email';

/**
 * Send notification email for admin-created users with password reset link.
 *
 * Creates a password reset token and sends an email explaining:
 * - An administrator created their account
 * - They need to set their password
 * - Support contact if they didn't expect this
 */
export const run = async ({ payload, io }: { payload: TSendAdminUserCreatedEmailJobDefinition; io: JobRunIO }) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: payload.userId,
    },
  });

  const token = await io.runTask(`create-password-reset-token`, async () => {
    const passwordResetToken = await prisma.passwordResetToken.create({
      data: {
        token: crypto.randomBytes(18).toString('hex'),
        expiry: new Date(Date.now() + ONE_DAY),
        userId: user.id,
      },
    });

    return passwordResetToken.token;
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const resetPasswordLink = `${assetBaseUrl}/reset-password/${token}`;

  const emailTemplate = createElement(AdminUserCreatedTemplate, {
    assetBaseUrl,
    resetPasswordLink,
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
    subject: i18n._(msg`Welcome to Documenso`),
    html,
    text,
  });
};
