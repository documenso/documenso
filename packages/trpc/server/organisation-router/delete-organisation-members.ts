import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
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

    ctx.logger.info({
      input: {
        organisationId,
        organisationMemberIds,
      },
    });

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
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    include: {
      subscription: true,
      organisationClaim: true,
      teams: {
        select: {
          id: true,
        },
      },
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

  const inviteCount = organisation.invites.length;
  const newMemberCount = organisation.members.length + inviteCount - membersToDelete.length;

  // Removing members is a reducing operation, so we don't gate it on the
  // subscription being present. Sync Stripe only when one exists.
  if (organisation.subscription) {
    await syncMemberCountWithStripeSeatPlan(
      organisation.subscription,
      organisationClaim,
      newMemberCount,
    );
  }

  const removedUserIds = membersToDelete.map((member) => member.userId);
  const teamIds = organisation.teams.map((team) => team.id);

  await prisma.$transaction(async (tx) => {
    // Removing an OrganisationMember cascades the user out of every team in
    // the org via OrganisationGroupMember, but their authored Envelope rows
    // still reference them. Reassign those to the org owner so they remain
    // reachable after the member loses access (mirrors delete-user.ts).
    if (removedUserIds.length > 0 && teamIds.length > 0) {
      await tx.envelope.updateMany({
        where: {
          userId: {
            in: removedUserIds,
          },
          teamId: {
            in: teamIds,
          },
        },
        data: {
          userId: organisation.ownerUserId,
        },
      });
    }

    await tx.organisationMember.deleteMany({
      where: {
        id: {
          in: organisationMemberIds,
        },
        organisationId,
      },
    });
  });

  for (const member of membersToDelete) {
    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId,
        memberUserId: member.userId,
      },
    });
  }
};
