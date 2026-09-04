import { mailer } from '@documenso/email/mailer';
import { SignupInviteEmailTemplate } from '@documenso/email/templates/signup-invite';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '@documenso/lib/constants/email';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { SignupInviteStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import { createElement } from 'react';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { generateDatabaseId } from '../../universal/id';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { computeSignupInviteExpiresAt, resolveSignupInviteExpiryDays } from './get-default-signup-invite-expiry-days';
import { normalizeSignupInviteEmail } from './get-signup-invite-by-token';
import { isSignupInviteSecretConfigured } from './is-signup-invite-secret-configured';

export type CreateSignupInviteOptions = {
  email: string;
  expiresInDays?: number;
};

export type CreateSignupInviteResult = {
  id: string;
  email: string;
  token: string;
  expiresAt: Date;
  inviteUrl: string;
  status: typeof SignupInviteStatus.PENDING;
};

const sendSignupInviteEmail = async ({
  email,
  token,
  expiresAt,
}: {
  email: string;
  token: string;
  expiresAt: Date;
}) => {
  const template = createElement(SignupInviteEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    email,
    token,
    expiresAt,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  await mailer.sendMail({
    to: email,
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject: i18n._(msg`You've been invited to create a Documenso account`),
    html,
    text,
  });
};

export const createSignupInvite = async ({
  email,
  expiresInDays,
}: CreateSignupInviteOptions): Promise<CreateSignupInviteResult> => {
  if (!isSignupInviteSecretConfigured()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Signup invite secret is not configured',
    });
  }

  const normalizedEmail = normalizeSignupInviteEmail(email);
  const resolvedExpiryDays = resolveSignupInviteExpiryDays(expiresInDays);
  const expiresAt = computeSignupInviteExpiresAt(resolvedExpiryDays);
  const token = nanoid();

  const invite = await prisma.$transaction(async (tx) => {
    await tx.signupInvite.updateMany({
      where: {
        email: normalizedEmail,
        status: SignupInviteStatus.PENDING,
      },
      data: {
        status: SignupInviteStatus.REVOKED,
      },
    });

    return await tx.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email: normalizedEmail,
        token,
        expiresAt,
        status: SignupInviteStatus.PENDING,
      },
    });
  });

  await sendSignupInviteEmail({
    email: normalizedEmail,
    token: invite.token,
    expiresAt: invite.expiresAt,
  });

  return {
    id: invite.id,
    email: invite.email,
    token: invite.token,
    expiresAt: invite.expiresAt,
    inviteUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/signup-invite/${invite.token}`,
    status: SignupInviteStatus.PENDING,
  };
};
