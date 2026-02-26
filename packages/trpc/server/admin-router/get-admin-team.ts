import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import { ZGetAdminTeamRequestSchema, ZGetAdminTeamResponseSchema } from './get-admin-team.types';

export const getAdminTeamRoute = adminProcedure
  .input(ZGetAdminTeamRequestSchema)
  .output(ZGetAdminTeamResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId } = input;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const [team, memberCount] = await Promise.all([
      prisma.team.findUnique({
        where: {
          id: teamId,
        },
        include: {
          organisation: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
          teamEmail: true,
          teamGlobalSettings: true,
        },
      }),
      prisma.organisationMember.count({
        where: {
          organisationGroupMembers: {
            some: {
              group: {
                teamGroups: {
                  some: {
                    teamId,
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team not found',
      });
    }

    return {
      ...team,
      memberCount,
    };
  });
