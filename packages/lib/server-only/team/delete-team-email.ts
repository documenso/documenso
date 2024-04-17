import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { TeamEmailRemovedTemplate } from '@documenso/email/templates/team-email-removed';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { prisma } from '@documenso/prisma';

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
  const team = await prisma.$transaction(async (tx) => {
    const foundTeam = await tx.team.findFirstOrThrow({
      where: {
        id: teamId,
        OR: [
          {
            teamEmail: {
              email: userEmail,
            },
          },
          {
            members: {
              some: {
                userId,
                role: {
                  in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
                },
              },
            },
          },
        ],
      },
      include: {
        teamEmail: true,
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    await tx.teamEmail.delete({
      where: {
        teamId,
      },
    });

    return foundTeam;
  });

  try {
    const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';

    const template = createElement(TeamEmailRemovedTemplate, {
      assetBaseUrl,
      baseUrl: WEBAPP_BASE_URL,
      teamEmail: team.teamEmail?.email ?? '',
      teamName: team.name,
      teamUrl: team.url,
    });

    await mailer.sendMail({
      to: {
        address: team.owner.email,
        name: team.owner.name ?? '',
      },
      from: {
        name: FROM_NAME,
        address: FROM_ADDRESS,
      },
      subject: `Team email has been revoked for ${team.name}`,
      html: render(template),
      text: render(template, { plainText: true }),
    });
  } catch (e) {
    // Todo: Teams - Alert us.
    // We don't want to prevent a user from revoking access because an email could not be sent.
  }
};
