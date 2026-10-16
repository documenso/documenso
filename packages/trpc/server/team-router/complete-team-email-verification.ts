import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';
import { procedure } from '../trpc';
import {
  ZCompleteTeamEmailVerificationRequestSchema,
  ZCompleteTeamEmailVerificationResponseSchema,
} from './complete-team-email-verification.types';

/**
 * Unauthenicated procedure.
 */
export const completeTeamEmailVerificationRoute = procedure
  .input(ZCompleteTeamEmailVerificationRequestSchema)
  .output(ZCompleteTeamEmailVerificationResponseSchema)
  .mutation(async ({ input }) => {
    const { token } = input;

    const teamEmailVerification = await prisma.teamEmailVerification.findUnique({
      where: {
        token,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!teamEmailVerification || isTokenExpired(teamEmailVerification.expiresAt)) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Verification token is invalid or has expired.',
      });
    }

    const { team, email, name } = teamEmailVerification;

    if (teamEmailVerification.completed) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Team email verification has already been completed.',
      });
    }

    await prisma.$transaction(async (tx) => {
      const existingTeamEmail = await tx.teamEmail.findFirst({
        where: {
          OR: [{ email }, { teamId: team.id }],
        },
      });

      if (existingTeamEmail) {
        throw new AppError(AppErrorCode.ALREADY_EXISTS, {
          message: 'Email already taken by another team, or this team already has an email.',
        });
      }

      await tx.teamEmailVerification.updateMany({
        where: {
          teamId: team.id,
          email,
        },
        data: {
          completed: true,
        },
      });

      await tx.teamEmailVerification.deleteMany({
        where: {
          teamId: team.id,
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      await tx.teamEmail.create({
        data: {
          teamId: team.id,
          email,
          name,
        },
      });
    });
  });
