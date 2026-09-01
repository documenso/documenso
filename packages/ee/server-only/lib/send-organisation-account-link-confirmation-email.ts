import { mailer } from '@documenso/email/mailer';
import { OrganisationAccountLinkConfirmationTemplate } from '@documenso/email/templates/organisation-account-link-confirmation';
import { getI18nInstance } from '@documenso/lib/client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '@documenso/lib/constants/email';
import { ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getEmailContext } from '@documenso/lib/server-only/email/get-email-context';
import type { TOrganisationAccountLinkMetadata } from '@documenso/lib/types/organisation';
import { renderEmailWithI18N } from '@documenso/lib/utils/render-email-with-i18n';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import crypto from 'crypto';
import { DateTime } from 'luxon';
import { createElement } from 'react';

export type SendOrganisationAccountLinkConfirmationEmailProps = TOrganisationAccountLinkMetadata & {
  organisationName: string;
};

export const sendOrganisationAccountLinkConfirmationEmail = async ({
  type,
  userId,
  organisationId,
  organisationName,
  oauthConfig,
}: SendOrganisationAccountLinkConfirmationEmailProps) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    include: {
      verificationTokens: {
        where: {
          identifier: ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  const [previousVerificationToken] = user.verificationTokens;

  // If we've sent a token in the last 5 minutes, don't send another one
  if (
    previousVerificationToken?.createdAt &&
    DateTime.fromJSDate(previousVerificationToken.createdAt).diffNow('minutes').minutes > -5
  ) {
    return;
  }

  const token = crypto.randomBytes(20).toString('hex');

  const createdToken = await prisma.verificationToken.create({
    data: {
      identifier: ORGANISATION_ACCOUNT_LINK_VERIFICATION_TOKEN_IDENTIFIER,
      token,
      expires: DateTime.now().plus({ minutes: 30 }).toJSDate(),
      metadata: {
        type,
        userId,
        organisationId,
        oauthConfig,
      } satisfies TOrganisationAccountLinkMetadata,
      userId,
    },
  });

  // We only take `emailLanguage` here and intentionally ignore the resolved
  // `emailTransport`/`senderEmail`. Unlike other INTERNAL emails, this is an
  // auth-critical SSO account creation/linking confirmation: it must always be
  // delivered from trusted Documenso infrastructure (see the `mailer.sendMail`
  // below). Routing it through the organisation's own (potentially
  // misconfigured) transport could block account linking and lock users out of
  // their own SSO setup.
  const { emailLanguage } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'organisation',
      organisationId,
    },
    meta: null,
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const confirmationLink = `${assetBaseUrl}/organisation/sso/confirmation/${createdToken.token}`;

  const confirmationTemplate = createElement(OrganisationAccountLinkConfirmationTemplate, {
    type,
    assetBaseUrl,
    confirmationLink,
    organisationName,
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(confirmationTemplate, { lang: emailLanguage }),
    renderEmailWithI18N(confirmationTemplate, { lang: emailLanguage, plainText: true }),
  ]);

  const i18n = await getI18nInstance(emailLanguage);

  // Deliberately uses the global Documenso mailer + internal sender (not the
  // organisation's configured email transport) so auth/SSO confirmation mail is
  // always sent from trusted, controlled infrastructure. See the note on the
  // getEmailContext call above.
  return mailer.sendMail({
    to: {
      address: user.email,
      name: user.name || '',
    },
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject: type === 'create' ? i18n._(msg`Account creation request`) : i18n._(msg`Account linking request`),
    html,
    text,
  });
};
