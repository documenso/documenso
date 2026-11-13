import OrganisationLimitsUpdatedEmailTemplate, {
  ORGANISATION_LIMITS_UPDATED_SUBJECT,
} from '@documenso/email/templates/organisation-limits-updated';
import { prisma } from '@documenso/prisma';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendOrganisationLimitsUpdatedEmailJobDefinition } from './send-organisation-limits-updated-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendOrganisationLimitsUpdatedEmailJobDefinition;
  io: JobRunIO;
}) => {
  const organisation = await prisma.organisation.findFirstOrThrow({
    where: {
      id: payload.organisationId,
    },
    select: {
      id: true,
      name: true,
      owner: {
        select: {
          email: true,
        },
      },
    },
  });

  const { branding, emailLanguage, senderEmail, emailTransport } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'organisation',
      organisationId: organisation.id,
    },
  });

  await io.runTask('send-organisation-limits-updated-email', async () => {
    const emailContent = createElement(OrganisationLimitsUpdatedEmailTemplate, {
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
      organisationName: organisation.name,
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(emailContent, { lang: emailLanguage, branding }),
      renderEmailWithI18N(emailContent, { lang: emailLanguage, branding, plainText: true }),
    ]);

    const i18n = await getI18nInstance(emailLanguage);

    await emailTransport.sendMail({
      to: organisation.owner.email,
      from: senderEmail,
      subject: i18n._(ORGANISATION_LIMITS_UPDATED_SUBJECT),
      html,
      text,
    });
  });
};
