import { createElement } from 'react';

import { msg } from '@lingui/macro';
import { z } from 'zod';

import { mailer } from '@documenso/email/mailer';
import TeamJoinEmailTemplate from '@documenso/email/templates/team-join';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

import { getI18nInstance } from '../../../client-only/providers/i18n.server';
import { WEBAPP_BASE_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../../utils/team-global-settings-to-branding';
import type { JobDefinition } from '../../client/_internal/job';

const SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID = 'send.team-member-joined.email';

const SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  teamId: z.number(),
  memberId: z.number(),
});

export const SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION = {
  id: SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Team Member Joined Email',
  version: '1.0.0',
  trigger: {
    name: SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
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
            assetBaseUrl: WEBAPP_BASE_URL,
            baseUrl: WEBAPP_BASE_URL,
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
  },
} as const satisfies JobDefinition<
  typeof SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
  z.infer<typeof SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA>
>;
