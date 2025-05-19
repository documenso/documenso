import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { validateIfSubscriptionIsRequired } from '@documenso/lib/utils/billing';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { OrganisationMemberInviteStatus } from '@documenso/prisma/client';

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

export const deleteOrganisationMembers = async ({
  userId,
  organisationId,
  organisationMemberIds,
}: DeleteOrganisationMembersProps) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(
      organisationId,
      userId,
      ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    ),
    include: {
      subscription: true,
      organisationClaim: true,
      members: {
        select: {
          id: true,
          userId: true,
        },
      },
      invites: {
        where: {
          status: OrganisationMemberInviteStatus.PENDING,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }

  const { organisationClaim } = organisation;

  const membersToDelete = organisation.members.filter((member) =>
    organisationMemberIds.includes(member.id),
  );

  const subscription = validateIfSubscriptionIsRequired(organisation.subscription);

  const inviteCount = organisation.invites.length;
  const newMemberCount = organisation.members.length + inviteCount - membersToDelete.length;

  if (subscription) {
    await syncMemberCountWithStripeSeatPlan(subscription, organisationClaim, newMemberCount);
  }

  await prisma.$transaction(async (tx) => {
    await tx.organisationMember.deleteMany({
      where: {
        id: {
          in: organisationMemberIds,
        },
        organisationId,
      },
    });

    // Todo: orgs
    // await jobs.triggerJob({
    //   name: 'send.team-member-left.email',
    //   payload: {
    //     teamId,
    //     memberUserId: leavingUser.id,
    //   },
    // });
  });
};
