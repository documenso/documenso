import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import OrganisationLeaveEmailTemplate from '@documenso/email/templates/organisation-leave';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../../constants/organisations';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendOrganisationMemberLeftEmailJobDefinition } from './send-organisation-member-left-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendOrganisationMemberLeftEmailJobDefinition;
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
          user: true,
        },
      },
    },
  });

  const oldMember = await prisma.user.findFirstOrThrow({
    where: {
      id: payload.memberUserId,
    },
  });

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'organisation',
      organisationId: organisation.id,
    },
  });

  for (const member of organisation.members) {
    if (member.userId === oldMember.id) {
      continue;
    }

    await io.runTask(
      `send-organisation-member-left-email--${oldMember.id}_${member.id}`,
      async () => {
        const emailContent = createElement(OrganisationLeaveEmailTemplate, {
          assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          memberName: oldMember.name || '',
          memberEmail: oldMember.email,
          organisationName: organisation.name,
          organisationUrl: organisation.url,
        });

        const lang = settings.documentLanguage;

        const [html, text] = await Promise.all([
          renderEmailWithI18N(emailContent, {
            lang,
            branding,
          }),
          renderEmailWithI18N(emailContent, {
            lang,
            branding,
            plainText: true,
          }),
        ]);

        const i18n = await getI18nInstance(lang);

        await mailer.sendMail({
          to: member.user.email,
          from: {
            name: FROM_NAME,
            address: FROM_ADDRESS,
          },
          subject: i18n._(msg`A member has left your organisation`),
          html,
          text,
        });
      },
    );
  }
};
