import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import OrganisationInviteDeclinedEmailTemplate from '@documenso/email/templates/organisation-invite-declined';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../../constants/organisations';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendOrganisationMemberInviteDeclinedEmailJobDefinition } from './send-organisation-member-invite-declined-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendOrganisationMemberInviteDeclinedEmailJobDefinition;
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

  const inviteeUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: payload.inviteeEmail,
        mode: 'insensitive',
      },
    },
    select: {
      name: true,
      email: true,
    },
  });

  const inviteeName = inviteeUser?.name || '';
  const inviteeEmail = inviteeUser?.email ?? payload.inviteeEmail;

  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'organisation',
      organisationId: organisation.id,
    },
  });

  for (const member of organisation.members) {
    await io.runTask(
      `send-organisation-member-invite-declined-email--${payload.inviteId}_${member.id}`,
      async () => {
        const emailContent = createElement(OrganisationInviteDeclinedEmailTemplate, {
          assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          inviteeName,
          inviteeEmail,
          organisationName: organisation.name,
          organisationUrl: organisation.url,
        });

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
