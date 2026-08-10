import { mailer } from '@documenso/email/mailer';
import { OrganisationDeleteEmailTemplate } from '@documenso/email/templates/organisation-delete';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../constants/email';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import type { EmailContextResponse } from '../email/get-email-context';

export type SendOrganisationDeleteEmailOptions = {
  email: string;
  organisationName: string;
  deletedByAdmin?: boolean;
  emailContext: Omit<EmailContextResponse, 'emailTransport'>;
};

/**
 * Sends an "organisation deleted" notification email.
 */
export const sendOrganisationDeleteEmail = async ({
  email,
  organisationName,
  deletedByAdmin = false,
  emailContext,
}: SendOrganisationDeleteEmailOptions) => {
  const template = createElement(OrganisationDeleteEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    organisationName,
    deletedByAdmin,
  });

  const { branding, emailLanguage } = emailContext;

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang: emailLanguage, branding }),
    renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
  ]);

  const i18n = await getI18nInstance(emailLanguage);

  // This is sent through the global Documenso mailer (the org's transport is
  // intentionally not used during deletion), so use the Documenso sender to keep
  // the From-address aligned with the sending infrastructure (SPF/DKIM). Note the
  // org's `senderEmail` on `emailContext` could be a custom transport address.
  await mailer.sendMail({
    to: email,
    from: DOCUMENSO_INTERNAL_EMAIL,
    subject: i18n._(msg`Organisation "${organisationName}" has been deleted`),
    html,
    text,
  });
};
