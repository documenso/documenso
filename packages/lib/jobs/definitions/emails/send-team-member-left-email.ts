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
import type { JobDefinition } from '../../client/_internal/job';

const SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION_ID = 'send.team-member-left.email';

const SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  teamId: z.number(),
  memberUserId: z.number(),
});

export const SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION = {
  id: SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Team Member Left Email',
  version: '1.0.0',
  trigger: {
    name: SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION_SCHEMA,
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
      },
    });

    const oldMember = await prisma.user.findFirstOrThrow({
      where: {
        id: payload.memberUserId,
      },
    });

    for (const member of team.members) {
      await io.runTask(`send-team-member-left-email--${oldMember.id}_${member.id}`, async () => {
        const emailContent = TeamJoinEmailTemplate({
          assetBaseUrl: WEBAPP_BASE_URL,
          baseUrl: WEBAPP_BASE_URL,
          memberName: oldMember.name || '',
          memberEmail: oldMember.email,
          teamName: team.name,
          teamUrl: team.url,
        });

        const [html, text] = await Promise.all([
          renderEmailWithI18N(emailContent),
          renderEmailWithI18N(emailContent, { plainText: true }),
        ]);

        const i18n = await getI18nInstance();

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
  },
} as const satisfies JobDefinition<
  typeof SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION_ID,
  z.infer<typeof SEND_TEAM_MEMBER_LEFT_EMAIL_JOB_DEFINITION_SCHEMA>
>;
