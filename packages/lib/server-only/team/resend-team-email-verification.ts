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
    where: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
    include: {
      emailVerification: true,
    },
  });

  if (!team) {
    throw new AppError('TeamNotFound', {
      message: 'User is not a member of the team.',
    });
  }

  await prisma.$transaction(
    async (tx) => {
      const { emailVerification } = team;

      if (!emailVerification) {
        throw new AppError('VerificationNotFound', {
          message: 'No team email verification exists for this team.',
        });
      }

      const { token, expiresAt } = createTokenVerification({ hours: 1 });

      await tx.teamEmailVerification.update({
        where: {
          teamId,
        },
        data: {
          token,
          expiresAt,
        },
      });

      await sendTeamEmailVerificationEmail(emailVerification.email, token, team);
    },
    { timeout: 30_000 },
  );
};
