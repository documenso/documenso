import { mailer } from '@documenso/email/mailer';
import { OrganisationDeleteEmailTemplate } from '@documenso/email/templates/organisation-delete';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import type { EmailContextResponse } from '../email/get-email-context';

export type SendOrganisationDeleteEmailOptions = {
  email: string;
  organisationName: string;
  deletedByAdmin?: boolean;
  emailContext: EmailContextResponse;
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

  const { branding, emailLanguage, senderEmail } = emailContext;

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang: emailLanguage, branding }),
    renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
  ]);

  const i18n = await getI18nInstance(emailLanguage);

  await mailer.sendMail({
    to: email,
    from: senderEmail,
    subject: i18n._(msg`Organisation "${organisationName}" has been deleted`),
    html,
    text,
  });
};
