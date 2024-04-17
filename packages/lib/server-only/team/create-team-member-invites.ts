import { createElement } from 'react';

import { nanoid } from 'nanoid';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import type { TeamInviteEmailProps } from '@documenso/email/templates/team-invite';
import { TeamInviteEmailTemplate } from '@documenso/email/templates/team-invite';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { TeamMemberInviteStatus } from '@documenso/prisma/client';
import type { TCreateTeamMemberInvitesMutationSchema } from '@documenso/trpc/server/team-router/schema';

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
}: CreateTeamMemberInvitesOptions) => {
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
    },
  });

  const teamMemberEmails = team.members.map((member) => member.user.email);
  const teamMemberInviteEmails = team.invites.map((invite) => invite.email);
  const currentTeamMember = team.members.find((member) => member.user.id === userId);

  if (!currentTeamMember) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'User not part of team.');
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
    throw new AppError(
      AppErrorCode.UNAUTHORIZED,
      'User does not have permission to set high level roles',
    );
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
        teamName: team.name,
        teamUrl: team.url,
        senderName: userName,
      }),
    ),
  );

  const sendEmailResultErrorList = sendEmailResult.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (sendEmailResultErrorList.length > 0) {
    console.error(JSON.stringify(sendEmailResultErrorList));

    throw new AppError(
      'EmailDeliveryFailed',
      'Failed to send invite emails to one or more users.',
      `Failed to send invites to ${sendEmailResultErrorList.length}/${teamMemberInvites.length} users.`,
    );
  }
};

type SendTeamMemberInviteEmailOptions = Omit<TeamInviteEmailProps, 'baseUrl' | 'assetBaseUrl'> & {
  email: string;
};

/**
 * Send an email to a user inviting them to join a team.
 */
export const sendTeamMemberInviteEmail = async ({
  email,
  ...emailTemplateOptions
}: SendTeamMemberInviteEmailOptions) => {
  const template = createElement(TeamInviteEmailTemplate, {
    assetBaseUrl: WEBAPP_BASE_URL,
    baseUrl: WEBAPP_BASE_URL,
    ...emailTemplateOptions,
  });

  await mailer.sendMail({
    to: email,
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: `You have been invited to join ${emailTemplateOptions.teamName} on Documenso`,
    html: render(template),
    text: render(template, { plainText: true }),
  });
};
