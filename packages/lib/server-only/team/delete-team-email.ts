import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { TeamEmailRemovedTemplate } from '@documenso/email/templates/team-email-removed';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getEmailContext } from '../email/get-email-context';

export type DeleteTeamEmailOptions = {
  userId: number;
  userEmail: string;
  teamId: number;
};

/**
 * Delete a team email.
 *
 * The user must either be part of the team with the required permissions, or the owner of the email.
 */
export const deleteTeamEmail = async ({ userId, userEmail, teamId }: DeleteTeamEmailOptions) => {
  const { branding, emailLanguage, senderEmail } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'team',
      teamId,
    },
  });

  const team = await prisma.team.findFirstOrThrow({
    where: {
      OR: [
        buildTeamWhereQuery({
          teamId,
          userId,
          roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
        }),
        {
          id: teamId,
          teamEmail: {
            email: userEmail,
          },
        },
      ],
    },
    include: {
      teamEmail: true,
      organisation: {
        select: {
          owner: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  await prisma.teamEmail.delete({
    where: {
      teamId,
    },
  });

  try {
    const assetBaseUrl = env('NEXT_PUBLIC_WEBAPP_URL') || 'http://localhost:3000';

    const template = createElement(TeamEmailRemovedTemplate, {
      assetBaseUrl,
      baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
      teamEmail: team.teamEmail?.email ?? '',
      teamName: team.name,
      teamUrl: team.url,
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(template, { lang: emailLanguage, branding }),
      renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
    ]);

    const i18n = await getI18nInstance(emailLanguage);

    await mailer.sendMail({
      to: {
        address: team.organisation.owner.email,
        name: team.organisation.owner.name ?? '',
      },
      from: senderEmail,
      subject: i18n._(msg`Team email has been revoked for ${team.name}`),
      html,
      text,
    });
  } catch (e) {
    // Todo: Teams - Alert us.
    // We don't want to prevent a user from revoking access because an email could not be sent.
  }
};
