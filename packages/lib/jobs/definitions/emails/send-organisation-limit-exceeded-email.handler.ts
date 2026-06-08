import OrganisationLimitExceededEmailTemplate from '@documenso/email/templates/organisation-limit-exceeded';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';
import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../../constants/organisations';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { INTERNAL_CLAIM_ID } from '../../../types/subscription';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendOrganisationLimitExceededEmailJobDefinition } from './send-organisation-limit-exceeded-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendOrganisationLimitExceededEmailJobDefinition;
  io: JobRunIO;
}) => {
  const organisation = await prisma.organisation.findFirstOrThrow({
    where: {
      id: payload.organisationId,
    },
    include: {
      organisationClaim: true,
      members: {
        where: {
          organisationGroupMembers: {
            some: {
              group: {
                organisationRole: {
                  in: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
                },
              },
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
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

  // Do not send emails for "free" claims.
  if (organisation.organisationClaim.originalSubscriptionClaimId === INTERNAL_CLAIM_ID.FREE) {
    io.logger.info({
      msg: 'Skipping organisation limit exceeded email for "free" claim',
      organisationId: organisation.id,
    });

    return;
  }

  for (const member of organisation.members) {
    await io.runTask(`send-organisation-limit-exceeded-email-${member.id}`, async () => {
      const emailContent = createElement(OrganisationLimitExceededEmailTemplate, {
        assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
        organisationName: organisation.name,
        counter: payload.counter,
        kind: payload.kind,
        period: payload.period,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(emailContent, { lang: emailLanguage, branding }),
        renderEmailWithI18N(emailContent, { lang: emailLanguage, branding, plainText: true }),
      ]);

      const i18n = await getI18nInstance(emailLanguage);

      await emailTransport.sendMail({
        to: member.user.email,
        from: senderEmail,
        subject: i18n._(msg`Organisation Review Required`),
        html,
        text,
      });
    });
  }

  // Todo: Logging
  // Todo: Decide if we want to send an email or alert via another software.
  // const i18n = await getI18nInstance('en');

  // // Email our support team.
  // await mailer.sendMail({
  //   to: SUPPORT_EMAIL,
  //   from: senderEmail,
  //   subject: i18n._(msg`An organisation has exceeded their fair use limits`),
  //   text: `
  //     Organisation: ${organisation.name}
  //     Organisation ID: ${organisation.id}
  //     Counter: ${payload.counter}
  //     Kind: ${payload.kind}
  //     Period: ${payload.period}
  //   `,
  // });
};
