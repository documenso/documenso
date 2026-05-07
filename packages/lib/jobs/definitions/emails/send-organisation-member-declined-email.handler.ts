import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import OrganisationDeclinedEmailTemplate from '@documenso/email/templates/organisation-declined';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../../constants/organisations';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendOrganisationMemberDeclinedEmailJobDefinition } from './send-organisation-member-declined-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendOrganisationMemberDeclinedEmailJobDefinition;
  io: JobRunIO;
}) => {
  const organisation = await prisma.organisation.findFirstOrThrow({
    where: {
      id: payload.organisationId,
    },
    include: {
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

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'organisation',
      organisationId: organisation.id,
    },
  });

  for (const member of organisation.members) {
    await io.runTask(
      `send-organisation-member-declined-email--${payload.memberEmail}_${member.id}`,
      async () => {
        const emailContent = createElement(OrganisationDeclinedEmailTemplate, {
          assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          memberEmail: payload.memberEmail,
          organisationName: organisation.name,
          organisationUrl: organisation.url || '',
        });

        // !: Replace with the actual language of the recipient later
        const [html, text] = await Promise.all([
          renderEmailWithI18N(emailContent, {
            lang: emailLanguage,
            branding,
          }),
          renderEmailWithI18N(emailContent, {
            lang: emailLanguage,
            branding,
            plainText: true,
          }),
        ]);

        const i18n = await getI18nInstance(emailLanguage);

        await mailer.sendMail({
          to: member.user.email,
          from: senderEmail,
          subject: i18n._(msg`An organisation invitation was declined`),
          html,
          text,
        });
      },
    );
  }
};
