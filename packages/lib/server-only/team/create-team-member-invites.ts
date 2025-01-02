import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Team, TeamGlobalSettings } from '@prisma/client';
import { TeamMemberInviteStatus } from '@prisma/client';
import { nanoid } from 'nanoid';

import { mailer } from '@documenso/email/mailer';
import { TeamInviteEmailTemplate } from '@documenso/email/templates/team-invite';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import type { TCreateTeamMemberInvitesMutationSchema } from '@documenso/trpc/server/team-router/schema';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

export type CreateTeamMemberInvitesOptions = {
  userId: number;
  userName: string;
  teamId: number;
  invitations: TCreateTeamMemberInvitesMutationSchema['invitations'];
};

/**
 * Invite team members via email to join a team.
 */
export const createTeamMemberInvites = async ({
  userId,
  userName,
  teamId,
  invitations,
}: CreateTeamMemberInvitesOptions): Promise<void> => {
  const team = await prisma.team.findFirstOrThrow({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
          role: {
            in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
          },
        },
      },
    },
    include: {
      members: {
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      invites: true,
      teamGlobalSettings: true,
    },
  });

  const teamMemberEmails = team.members.map((member) => member.user.email);
  const teamMemberInviteEmails = team.invites.map((invite) => invite.email);
  const currentTeamMember = team.members.find((member) => member.user.id === userId);

  if (!currentTeamMember) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'User not part of team.',
    });
  }

  const usersToInvite = invitations.filter((invitation) => {
    // Filter out users that are already members of the team.
    if (teamMemberEmails.includes(invitation.email)) {
      return false;
    }

    // Filter out users that have already been invited to the team.
    if (teamMemberInviteEmails.includes(invitation.email)) {
      return false;
    }

    return true;
  });

  const unauthorizedRoleAccess = usersToInvite.some(
    ({ role }) => !isTeamRoleWithinUserHierarchy(currentTeamMember.role, role),
  );

  if (unauthorizedRoleAccess) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'User does not have permission to set high level roles',
    });
  }

  const teamMemberInvites = usersToInvite.map(({ email, role }) => ({
    email,
    teamId,
    role,
    status: TeamMemberInviteStatus.PENDING,
    token: nanoid(32),
  }));

  await prisma.teamMemberInvite.createMany({
    data: teamMemberInvites,
  });

  const sendEmailResult = await Promise.allSettled(
    teamMemberInvites.map(async ({ email, token }) =>
      sendTeamMemberInviteEmail({
        email,
        token,
        team,
        senderName: userName,
      }),
    ),
  );

  const sendEmailResultErrorList = sendEmailResult.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (sendEmailResultErrorList.length > 0) {
    console.error(JSON.stringify(sendEmailResultErrorList));

    throw new AppError('EmailDeliveryFailed', {
      message: 'Failed to send invite emails to one or more users.',
      userMessage: `Failed to send invites to ${sendEmailResultErrorList.length}/${teamMemberInvites.length} users.`,
    });
  }
};

type SendTeamMemberInviteEmailOptions = {
  email: string;
  senderName: string;
  token: string;
  team: Team & {
    teamGlobalSettings?: TeamGlobalSettings | null;
  };
};

/**
 * Send an email to a user inviting them to join a team.
 */
export const sendTeamMemberInviteEmail = async ({
  email,
  senderName,
  token,
  team,
}: SendTeamMemberInviteEmailOptions) => {
  const template = createElement(TeamInviteEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    senderName,
    token,
    teamName: team.name,
    teamUrl: team.url,
  });

  const branding = team.teamGlobalSettings
    ? teamGlobalSettingsToBranding(team.teamGlobalSettings)
    : undefined;

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang: team.teamGlobalSettings?.documentLanguage, branding }),
    renderEmailWithI18N(template, {
      lang: team.teamGlobalSettings?.documentLanguage,
      branding,
      plainText: true,
    }),
  ]);

  const i18n = await getI18nInstance(team.teamGlobalSettings?.documentLanguage);

  await mailer.sendMail({
    to: email,
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: i18n._(msg`You have been invited to join ${team.name} on Documenso`),
    html,
    text,
  });
};
