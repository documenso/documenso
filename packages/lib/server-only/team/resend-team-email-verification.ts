import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError } from '@documenso/lib/errors/app-error';
import { createTokenVerification } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';
import { sendTeamEmailVerificationEmail } from './create-team-email-verification';

export type ResendTeamMemberInvitationOptions = {
  userId: number;
  teamId: number;
};

/**
 * Resend a team email verification with a new token.
 */
export const resendTeamEmailVerification = async ({
  userId,
  teamId,
}: ResendTeamMemberInvitationOptions): Promise<void> => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    include: {
      emailVerification: true,
    },
  });

  if (!team) {
    throw new AppError('TeamNotFound', {
      message: 'User is not a member of the team.',
    });
  }

  const { emailVerification } = team;

  if (!emailVerification) {
    throw new AppError('VerificationNotFound', {
      message: 'No team email verification exists for this team.',
    });
  }

  const { token, expiresAt } = createTokenVerification({ hours: 1 });

  await prisma.teamEmailVerification.update({
    where: {
      teamId,
    },
    data: {
      token,
      expiresAt,
    },
  });

  // Send email outside any transaction to avoid holding a connection
  // open during network I/O.
  await sendTeamEmailVerificationEmail(emailVerification.email, token, team);
};
