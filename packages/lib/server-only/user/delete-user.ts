import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { orphanEnvelopes } from '../envelope/orphan-envelopes';

export type DeleteUserOptions = {
  id: number;
};

export const deleteUser = async ({ id }: DeleteUserOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
    },
    include: {
      ownedOrganisations: {
        include: {
          teams: {
            select: {
              id: true,
            },
          },
        },
      },
      organisationMember: {
        include: {
          organisation: {
            include: {
              teams: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `User with ID ${id} not found`,
    });
  }

  // Get team IDs from organisations the user owns.
  const ownedTeamIds = user.ownedOrganisations.flatMap((org) => org.teams.map((team) => team.id));

  // Get team IDs from organisations the user is a member of (but not owner).
  const memberTeams = user.organisationMember
    .filter((member) => member.organisation.ownerUserId !== user.id)
    .flatMap((member) =>
      member.organisation.teams.map((team) => ({
        teamId: team.id,
        orgOwnerId: member.organisation.ownerUserId,
      })),
    );

  // For teams where user is the org owner - orphan their envelopes.
  await Promise.all(ownedTeamIds.map(async (teamId) => orphanEnvelopes({ teamId })));

  // For teams where user is a member (not owner) - transfer envelopes to team owner.
  await Promise.all(
    memberTeams.map(async ({ teamId, orgOwnerId }) => {
      return prisma.envelope.updateMany({
        where: {
          userId: user.id,
          teamId,
        },
        data: {
          userId: orgOwnerId,
        },
      });
    }),
  );

  return await prisma.user.delete({
    where: {
      id: user.id,
    },
  });
};
