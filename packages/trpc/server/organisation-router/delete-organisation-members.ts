import {
  ORGANISATION_MEMBER_ROLE_HIERARCHY,
  ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP,
} from '@documenso/lib/constants/organisations';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import {
  buildOrganisationWhereQuery,
  getHighestOrganisationRoleInGroup,
  isOrganisationRoleWithinUserHierarchy,
} from '@documenso/lib/utils/organisations';
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
      teams: {
        select: {
          id: true,
        },
      },
      members: {
        include: {
          organisationGroupMembers: {
            include: {
              group: true,
            },
          },
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }

  const membersToDelete = organisation.members.filter((member) => organisationMemberIds.includes(member.id));

  const currentUserMember = organisation.members.find((member) => member.userId === userId);

  if (!currentUserMember) {
    throw new AppError(AppErrorCode.UNAUTHORIZED);
  }

  const currentUserOrganisationRole = getHighestOrganisationRoleInGroup(
    currentUserMember.organisationGroupMembers.map(({ group }) => group),
  );

  // The roles the current user is allowed to act on (their own role and below).
  const manageableOrganisationRoles = ORGANISATION_MEMBER_ROLE_HIERARCHY[currentUserOrganisationRole];

  for (const member of membersToDelete) {
    // The organisation owner can never be removed via this route. Ownership must
    // be transferred first (mirrors the admin and update-member routes).
    if (member.userId === organisation.ownerUserId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot remove the organisation owner',
      });
    }

    const memberOrganisationRole = getHighestOrganisationRoleInGroup(
      member.organisationGroupMembers.map(({ group }) => group),
    );

    // A user cannot remove a member whose role is higher than their own
    // (e.g. a manager removing an admin).
    if (!isOrganisationRoleWithinUserHierarchy(currentUserOrganisationRole, memberOrganisationRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot remove a member with a higher role',
      });
    }
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
        userId: {
          not: organisation.ownerUserId,
        },
        organisationGroupMembers: {
          none: {
            group: {
              organisationRole: {
                notIn: manageableOrganisationRoles,
              },
            },
          },
        },
      },
    });
  });

  // Members were removed — queue a seat sync to true the Stripe quantity down to
  // the new count (no proration, no credit).
  await jobs.triggerJob({
    name: 'internal.sync-organisation-seats',
    payload: { organisationId },
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
