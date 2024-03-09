import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

export type DeleteTeamMembersOptions = {
  /**
   * The ID of the user who is initiating this action.
   */
  userId: number;

  /**
   * The ID of the team to remove members from.
   */
  teamId: number;

  /**
   * The IDs of the team members to remove.
   */
  teamMemberIds: number[];
};

export const deleteTeamMembers = async ({
  userId,
  teamId,
  teamMemberIds,
}: DeleteTeamMembersOptions) => {
  await prisma.$transaction(
    async (tx) => {
      // Find the team and validate that the user is allowed to remove members.
      const team = await tx.team.findFirstOrThrow({
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
              id: true,
              userId: true,
              role: true,
            },
          },
          subscription: true,
        },
      });

      const currentTeamMember = team.members.find((member) => member.userId === userId);
      const teamMembersToRemove = team.members.filter((member) =>
        teamMemberIds.includes(member.id),
      );

      if (!currentTeamMember) {
        throw new AppError(AppErrorCode.NOT_FOUND, 'Team member record does not exist');
      }

      if (teamMembersToRemove.find((member) => member.userId === team.ownerUserId)) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, 'Cannot remove the team owner');
      }

      const isMemberToRemoveHigherRole = teamMembersToRemove.some(
        (member) => !isTeamRoleWithinUserHierarchy(currentTeamMember.role, member.role),
      );

      if (isMemberToRemoveHigherRole) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, 'Cannot remove a member with a higher role');
      }

      // Remove the team members.
      await tx.teamMember.deleteMany({
        where: {
          id: {
            in: teamMemberIds,
          },
          teamId,
          userId: {
            not: team.ownerUserId,
          },
        },
      });

      if (IS_BILLING_ENABLED() && team.subscription) {
        const numberOfSeats = await tx.teamMember.count({
          where: {
            teamId,
          },
        });

        await updateSubscriptionItemQuantity({
          priceId: team.subscription.priceId,
          subscriptionId: team.subscription.planId,
          quantity: numberOfSeats,
        });
      }
    },
    { timeout: 30_000 },
  );
};
