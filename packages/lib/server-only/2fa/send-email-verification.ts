import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { randomInt } from 'crypto';

import { AuthenticationErrorCode } from '@documenso/auth/server/lib/errors/error-codes';
import { mailer } from '@documenso/email/mailer';
import { VerificationCodeTemplate } from '@documenso/email/templates/verification-code';
import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

const ExtendedAuthErrorCode = {
  ...AuthenticationErrorCode,
  InternalError: 'INTERNAL_ERROR',
  VerificationNotFound: 'VERIFICATION_NOT_FOUND',
  VerificationExpired: 'VERIFICATION_EXPIRED',
};

const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000;

export type SendEmailVerificationOptions = {
  userId: number;
  email: string;
};

export const sendEmailVerification = async ({ userId, email }: SendEmailVerificationOptions) => {
  try {
    const verificationCode = randomInt(100000, 1000000).toString();
    const i18n = await getI18nInstance();

    await prisma.userTwoFactorEmailVerification.upsert({
      where: {
        userId,
      },
      create: {
        userId,
        verificationCode,
        expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
      },
      update: {
        verificationCode,
        expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
      },
    });

    const template = createElement(VerificationCodeTemplate, {
      verificationCode,
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang: 'en' }),
      renderEmailWithI18N(template, { lang: 'en', plainText: true }),
    ]);

    await mailer.sendMail({
      to: email,
      from: {
        name: FROM_NAME,
        address: FROM_ADDRESS,
      },
      subject: i18n._(msg`Your verification code for document signing`),
      html,
      text,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending email verification', error);
    throw new AppError(ExtendedAuthErrorCode.InternalError);
  }
};

export type VerifyEmailCodeOptions = {
  userId: number;
  code: string;
};

export const verifyEmailCode = async ({ userId, code }: VerifyEmailCodeOptions) => {
  try {
    const verification = await prisma.userTwoFactorEmailVerification.findUnique({
      where: {
        userId,
      },
    });

    if (!verification) {
      throw new AppError(ExtendedAuthErrorCode.VerificationNotFound);
    }

    if (verification.expiresAt < new Date()) {
      throw new AppError(ExtendedAuthErrorCode.VerificationExpired);
    }

    if (verification.verificationCode !== code) {
      throw new AppError(AuthenticationErrorCode.InvalidTwoFactorCode);
    }

    await prisma.userTwoFactorEmailVerification.delete({
      where: {
        userId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error verifying email code', error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(ExtendedAuthErrorCode.InternalError);
  }
};
