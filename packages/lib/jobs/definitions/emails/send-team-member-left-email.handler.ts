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
import type { TSendTeamMemberLeftEmailJobDefinition } from './send-team-member-left-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendTeamMemberLeftEmailJobDefinition;
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

  const oldMember = await prisma.user.findFirstOrThrow({
    where: {
      id: payload.memberUserId,
    },
  });

  for (const member of team.members) {
    await io.runTask(`send-team-member-left-email--${oldMember.id}_${member.id}`, async () => {
      const emailContent = createElement(TeamJoinEmailTemplate, {
        assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
        baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
        memberName: oldMember.name || '',
        memberEmail: oldMember.email,
        teamName: team.name,
        teamUrl: team.url,
      });

      const branding = team.teamGlobalSettings
        ? teamGlobalSettingsToBranding(team.teamGlobalSettings)
        : undefined;

      const lang = team.teamGlobalSettings?.documentLanguage;

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
        subject: i18n._(msg`A team member has left ${team.name}`),
        html,
        text,
      });
    });
  }
};
