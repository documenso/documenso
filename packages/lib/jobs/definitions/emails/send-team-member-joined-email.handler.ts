import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { TeamMemberRole } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import TeamJoinEmailTemplate from '@documenso/email/templates/team-join';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../../utils/team-global-settings-to-branding';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendTeamMemberJoinedEmailJobDefinition } from './send-team-member-joined-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendTeamMemberJoinedEmailJobDefinition;
  io: JobRunIO;
}) => {
  const team = await prisma.team.findFirstOrThrow({
    where: {
      id: payload.teamId,
    },
    include: {
      members: {
        where: {
          role: {
            in: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
          },
        },
        include: {
          user: true,
        },
      },
      teamGlobalSettings: true,
    },
  });

  const invitedMember = await prisma.teamMember.findFirstOrThrow({
    where: {
      id: payload.memberId,
      teamId: payload.teamId,
    },
    include: {
      user: true,
    },
  });

  for (const member of team.members) {
    if (member.id === invitedMember.id) {
      continue;
    }

    await io.runTask(
      `send-team-member-joined-email--${invitedMember.id}_${member.id}`,
      async () => {
        const emailContent = createElement(TeamJoinEmailTemplate, {
          assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          memberName: invitedMember.user.name || '',
          memberEmail: invitedMember.user.email,
          teamName: team.name,
          teamUrl: team.url,
        });

        const branding = team.teamGlobalSettings
          ? teamGlobalSettingsToBranding(team.teamGlobalSettings)
          : undefined;

        const lang = team.teamGlobalSettings?.documentLanguage;

        // !: Replace with the actual language of the recipient later
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
          subject: i18n._(msg`A new member has joined your team`),
          html,
          text,
        });
      },
    );
  }
};
