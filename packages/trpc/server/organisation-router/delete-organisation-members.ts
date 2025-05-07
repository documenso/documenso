import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationMembersRequestSchema,
  ZDeleteOrganisationMembersResponseSchema,
} from './delete-organisation-members.types';

export const deleteOrganisationMembersRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMembersMeta)
  .input(ZDeleteOrganisationMembersRequestSchema)
  .output(ZDeleteOrganisationMembersResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, organisationMemberIds } = input;
    const userId = ctx.user.id;

    await deleteOrganisationMembers({
      userId,
      organisationId,
      organisationMemberIds,
    });
  });

type DeleteOrganisationMembersProps = {
  userId: number;
  organisationId: string;
  organisationMemberIds: string[];
};

/**
 * Deletes multiple organisation members.
 *
 * This logic is also used to leave a team (hence strange logic).
 */
export const deleteOrganisationMembers = async ({
  userId,
  organisationId,
  organisationMemberIds,
}: DeleteOrganisationMembersProps) => {
  const membersToDelete = await prisma.organisationMember.findMany({
    where: {
      id: {
        in: organisationMemberIds,
      },
      organisationId,
    },
  });

  // Prevent the user from deleting other users if they do not have permission.
  if (membersToDelete.some((member) => member.userId !== userId)) {
    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        userId,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }
  }

  // Todo: Orgs - Handle seats.
  await prisma.$transaction(
    async (tx) => {
      await tx.organisationMember.deleteMany({
        where: {
          id: {
            in: organisationMemberIds,
          },
          organisationId,
        },
      });

      // Todo: orgs handle removing groups

      // if (IS_BILLING_ENABLED() && team.subscription) {
      //   const numberOfSeats = await tx.teamMember.count({
      //     where: {
      //       teamId,
      //     },
      //   });

      //   await updateSubscriptionItemQuantity({
      //     priceId: team.subscription.priceId,
      //     subscriptionId: team.subscription.planId,
      //     quantity: numberOfSeats,
      //   });
      // }

      // await jobs.triggerJob({
      //   name: 'send.team-member-left.email',
      //   payload: {
      //     teamId,
      //     memberUserId: leavingUser.id,
      //   },
      // });
    },
    { timeout: 30_000 },
  );
};
