import { OrganisationGroupType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZDeleteAdminTeamMemberRequestSchema,
  ZDeleteAdminTeamMemberResponseSchema,
} from './delete-team-member.types';

export const deleteAdminTeamMemberRoute = adminProcedure
  .input(ZDeleteAdminTeamMemberRequestSchema)
  .output(ZDeleteAdminTeamMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { teamId, memberId } = input;

    ctx.logger.info({
      input: {
        teamId,
        memberId,
      },
    });

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      include: {
        teamGroups: {
          where: {
            organisationGroup: {
              type: OrganisationGroupType.INTERNAL_TEAM,
              organisationGroupMembers: {
                some: {
                  organisationMember: {
                    id: memberId,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team not found',
      });
    }

    const teamGroupToRemoveMemberFrom = team.teamGroups[0];

    if (!teamGroupToRemoveMemberFrom) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message:
          'Member is not directly assigned to this team. Inherited members cannot be removed here.',
      });
    }

    await prisma.organisationGroupMember.delete({
      where: {
        organisationMemberId_groupId: {
          organisationMemberId: memberId,
          groupId: teamGroupToRemoveMemberFrom.organisationGroupId,
        },
      },
    });
  });
