import { OrganisationGroupType, OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
import {
  LOWEST_ORGANISATION_ROLE,
  ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP,
} from '../../constants/organisations';
import { TEAM_INTERNAL_GROUPS } from '../../constants/teams';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { generateDefaultTeamSettings } from '../../utils/teams';

export type CreateTeamOptions = {
  /**
   * ID of the user creating the Team.
   */
  userId: number;

  /**
   * Name of the team to display.
   */
  teamName: string;

  /**
   * Unique URL of the team.
   *
   * Used as the URL path, example: https://documenso.com/t/{teamUrl}/settings
   */
  teamUrl: string; // Todo: orgs make unique

  /**
   * ID of the organisation the team belongs to.
   */
  organisationId: string;

  /**
   * Whether to inherit all members from the organisation.
   */
  inheritMembers: boolean;

  /**
   * List of additional groups to attach to the team.
   */
  groups?: {
    id: string;
    role: TeamMemberRole;
  }[];
};

export const createTeam = async ({
  userId,
  teamName,
  teamUrl,
  organisationId,
  inheritMembers,
}: CreateTeamOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(
      organisationId,
      userId,
      ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    ),
    include: {
      groups: true,
      subscription: true,
      organisationClaim: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found.',
    });
  }

  // Validate they have enough team slots. 0 means they can create unlimited teams.
  if (organisation.organisationClaim.teamCount !== 0 && IS_BILLING_ENABLED()) {
    const teamCount = await prisma.team.count({
      where: {
        organisationId,
      },
    });

    if (teamCount >= organisation.organisationClaim.teamCount) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached the maximum number of teams for your plan.',
      });
    }
  }

  // Inherit internal organisation groups to the team.
  // Organisation Admins/Mangers get assigned as team admins, members get assigned as team members.
  const internalOrganisationGroups = organisation.groups
    .filter((group) => {
      if (group.type !== OrganisationGroupType.INTERNAL_ORGANISATION) {
        return false;
      }

      // If we're inheriting members, allow all internal organisation groups.
      if (inheritMembers) {
        return true;
      }

      // Otherwise, only inherit organisation admins/managers.
      return (
        group.organisationRole === OrganisationMemberRole.ADMIN ||
        group.organisationRole === OrganisationMemberRole.MANAGER
      );
    })
    .map((group) =>
      match(group.organisationRole)
        .with(OrganisationMemberRole.ADMIN, OrganisationMemberRole.MANAGER, () => ({
          organisationGroupId: group.id,
          teamRole: TeamMemberRole.ADMIN,
        }))
        .with(OrganisationMemberRole.MEMBER, () => ({
          organisationGroupId: group.id,
          teamRole: TeamMemberRole.MEMBER,
        }))
        .exhaustive(),
    );

  await prisma.$transaction(async (tx) => {
    const teamSettings = await tx.teamGlobalSettings.create({
      data: generateDefaultTeamSettings(),
    });

    const team = await tx.team.create({
      data: {
        name: teamName,
        url: teamUrl,
        organisationId,
        teamGlobalSettingsId: teamSettings.id,
        teamGroups: {
          createMany: {
            // Attach the internal organisation groups to the team.
            data: internalOrganisationGroups,
          },
        },
      },
      include: {
        teamGroups: true,
      },
    });

    // Create the internal team groups.
    await Promise.all(
      TEAM_INTERNAL_GROUPS.map(async (teamGroup) =>
        tx.organisationGroup.create({
          data: {
            type: teamGroup.type,
            organisationRole: LOWEST_ORGANISATION_ROLE,
            organisationId,
            teamGroups: {
              create: {
                teamId: team.id,
                teamRole: teamGroup.teamRole,
              },
            },
          },
        }),
      ),
    );
  });
};
