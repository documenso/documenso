import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError } from '@documenso/lib/errors/app-error';
import { createTokenVerification } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';

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
}: ResendTeamMemberInvitationOptions) => {
  await prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findUniqueOrThrow({
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
          emailVerification: true,
        },
      });

      if (!team) {
        throw new AppError('TeamNotFound', 'User is not a member of the team.');
      }

      const { emailVerification } = team;

      if (!emailVerification) {
        throw new AppError(
          'VerificationNotFound',
          'No team email verification exists for this team.',
        );
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

      await sendTeamEmailVerificationEmail(emailVerification.email, token, team.name, team.url);
    },
    { timeout: 30_000 },
  );
};
