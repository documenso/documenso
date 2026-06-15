import { mailer } from '@documenso/email/mailer';
import OrganisationLimitAlertEmailTemplate from '@documenso/email/templates/organisation-limit-alert';
import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';

import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';
import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../../constants/email';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../../constants/organisations';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { INTERNAL_CLAIM_ID } from '../../../types/subscription';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendOrganisationLimitAlertEmailJobDefinition } from './send-organisation-limit-alert-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendOrganisationLimitAlertEmailJobDefinition;
  io: JobRunIO;
}) => {
  const organisation = await prisma.organisation.findFirstOrThrow({
    where: {
      id: payload.organisationId,
    },
    include: {
      organisationClaim: true,
      monthlyStats: {
        where: {
          period: payload.period,
        },
        select: {
          documentCount: true,
          emailCount: true,
          apiCount: true,
        },
      },
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
      msg: 'Skipping organisation limit alert email for "free" claim',
      organisationId: organisation.id,
    });

    return;
  }

  const memberSubject =
    payload.kind === 'quotaNearing' ? msg`Approaching Your Plan Limits` : msg`Organisation Review Required`;

  for (const member of organisation.members) {
    await io.runTask(`send-organisation-limit-alert-email-${member.id}`, async () => {
      const emailContent = createElement(OrganisationLimitAlertEmailTemplate, {
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
        subject: i18n._(memberSubject),
        html,
        text,
      });
    });
  }

  // Todo: Logging
  const i18n = await getI18nInstance('en');

  const supportSubject =
    payload.kind === 'quotaNearing'
      ? msg`An organisation is nearing their fair use limits`
      : msg`An organisation has exceeded their fair use limits`;

  // Email our support team. Purposefully sent from the internal email since the
  // global mailer is not authorized to send from custom per-plan transport addresses.
  await io.runTask('send-organisation-limit-alert-support-email', async () => {
    await mailer.sendMail({
      to: SUPPORT_EMAIL,
      from: DOCUMENSO_INTERNAL_EMAIL,
      subject: i18n._(supportSubject),
      text: `
        Organisation: ${organisation.name}
        Organisation ID: ${organisation.id}
        Organisation Claim Original ID: ${organisation.organisationClaim.originalSubscriptionClaimId}
        Email Quota: ${organisation.monthlyStats[0]?.emailCount || 0}/${organisation.organisationClaim.emailQuota ?? 'Unlimited'}
        API Quota: ${organisation.monthlyStats[0]?.apiCount || 0}/${organisation.organisationClaim.apiQuota ?? 'Unlimited'}
        Document Quota: ${organisation.monthlyStats[0]?.documentCount || 0}/${organisation.organisationClaim.documentQuota ?? 'Unlimited'}
        Counter: ${payload.counter}
        Kind: ${payload.kind}
        Period: ${payload.period}
      `,
    });
  });
};
