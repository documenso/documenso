// ABOUTME: Server-side logic for the team merge feature.
// ABOUTME: Provides getMergeImpact (shared count helper), mergeTeamsPreview, and mergeTeams transaction.
import { EnvelopeType, OrganisationGroupType, Prisma, TeamMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import type { TMergeTeamsPreviewResponse } from '@documenso/trpc/server/team-router/merge-teams.types';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { generateDatabaseId } from '../../universal/id';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { generateDefaultTeamSettings } from '../../utils/teams';

export type MergeTeamsPreviewOptions = {
  userId: number;
  organisationId: string;
  sourceTeamIds: number[];
  destinationTeamId?: number;
};

/**
 * Computes the impact counts for a merge of one or more source teams.
 *
 * Accepts either the base prisma client or a transaction client so it can be
 * reused inside a $transaction callback by Task 3.
 */
export const getMergeImpact = async (
  tx: Prisma.TransactionClient | typeof prisma,
  sourceTeamIds: number[],
  destinationTeamId?: number,
): Promise<TMergeTeamsPreviewResponse> => {
  if (sourceTeamIds.length === 0) {
    return {
      moving: { documents: 0, templates: 0, folders: 0, members: 0 },
      discarding: { webhooks: 0, apiTokens: 0, teamEmails: 0, teamSettings: 0 },
    };
  }

  const [
    documents,
    templates,
    folders,
    sourceGroups,
    webhooks,
    apiTokens,
    teamEmails,
    teamSettings,
  ] = await Promise.all([
    tx.envelope.count({
      where: { teamId: { in: sourceTeamIds }, type: EnvelopeType.DOCUMENT },
    }),
    tx.envelope.count({
      where: { teamId: { in: sourceTeamIds }, type: EnvelopeType.TEMPLATE },
    }),
    tx.folder.count({
      where: { teamId: { in: sourceTeamIds } },
    }),
    tx.teamGroup.findMany({
      where: { teamId: { in: sourceTeamIds } },
      include: { organisationGroup: true },
    }),
    tx.webhook.count({
      where: { teamId: { in: sourceTeamIds } },
    }),
    tx.apiToken.count({
      where: { teamId: { in: sourceTeamIds } },
    }),
    tx.teamEmail.count({
      where: { teamId: { in: sourceTeamIds } },
    }),
    tx.teamGlobalSettings.count({
      where: { team: { id: { in: sourceTeamIds } } },
    }),
  ]);

  // Determine which unique non-INTERNAL_TEAM groups from source teams would be
  // new additions on the destination team (i.e. not already attached there).
  const nonInternalGroups = sourceGroups.filter(
    (g) => g.organisationGroup.type !== OrganisationGroupType.INTERNAL_TEAM,
  );

  // Deduplicate by organisationGroupId across all source teams.
  const uniqueOrgGroupIds = [...new Set(nonInternalGroups.map((g) => g.organisationGroupId))];

  let members = uniqueOrgGroupIds.length;

  if (destinationTeamId !== undefined && uniqueOrgGroupIds.length > 0) {
    // Subtract groups that are already on the destination team.
    const alreadyOnDestination = await tx.teamGroup.count({
      where: {
        teamId: destinationTeamId,
        organisationGroupId: { in: uniqueOrgGroupIds },
      },
    });
    members -= alreadyOnDestination;
  }

  return {
    moving: { documents, templates, folders, members },
    discarding: { webhooks, apiTokens, teamEmails, teamSettings },
  };
};

/**
 * Returns a preview of what would be moved or discarded if the given source
 * teams were merged into the destination team (or a new team).
 */
export const mergeTeamsPreview = async ({
  userId,
  organisationId,
  sourceTeamIds,
  destinationTeamId,
}: MergeTeamsPreviewOptions): Promise<TMergeTeamsPreviewResponse> => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found.',
    });
  }

  // Validate all source team IDs belong to this organisation.
  if (sourceTeamIds.length > 0) {
    const validSourceCount = await prisma.team.count({
      where: { id: { in: sourceTeamIds }, organisationId },
    });

    if (validSourceCount !== sourceTeamIds.length) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'One or more source teams were not found in this organisation.',
      });
    }
  }

  // Validate destination team belongs to the organisation (if provided).
  if (destinationTeamId !== undefined) {
    const destinationTeam = await prisma.team.findFirst({
      where: { id: destinationTeamId, organisationId },
    });

    if (!destinationTeam) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Destination team was not found in this organisation.',
      });
    }
  }

  // Filter out the destination team from sources (it can't merge into itself).
  const effectiveSourceIds =
    destinationTeamId !== undefined
      ? sourceTeamIds.filter((id) => id !== destinationTeamId)
      : sourceTeamIds;

  if (effectiveSourceIds.length === 0) {
    return {
      moving: { documents: 0, templates: 0, folders: 0, members: 0 },
      discarding: { webhooks: 0, apiTokens: 0, teamEmails: 0, teamSettings: 0 },
    };
  }

  return getMergeImpact(prisma, effectiveSourceIds, destinationTeamId);
};

export type MergeTeamsOptions = {
  userId: number;
  organisationId: string;
  sourceTeamIds: number[];
  destinationTeamId?: number;
  newTeamName?: string;
  newTeamUrl?: string;
};

/**
 * Merges one or more source teams into a destination team inside a single
 * Prisma transaction. Envelopes and folders are reparented; non-INTERNAL_TEAM
 * member groups are consolidated; source teams and their orphaned settings are
 * deleted. Returns the impact counts describing what was moved or discarded.
 */
export const mergeTeams = async ({
  userId,
  organisationId,
  sourceTeamIds,
  destinationTeamId,
  newTeamName,
  newTeamUrl,
}: MergeTeamsOptions): Promise<TMergeTeamsPreviewResponse> => {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Validate the caller has MANAGE_ORGANISATION access.
      const organisation = await tx.organisation.findFirst({
        where: buildOrganisationWhereQuery({
          organisationId,
          userId,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      });

      if (!organisation) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Organisation not found.',
        });
      }

      // 2. Validate all source teams belong to this organisation.
      const sourceTeams = await tx.team.findMany({
        where: { id: { in: sourceTeamIds }, organisationId },
        select: { id: true, teamGlobalSettingsId: true },
      });

      if (sourceTeams.length !== sourceTeamIds.length) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'One or more source teams do not belong to this organisation.',
        });
      }

      // 3. Resolve the destination team.
      let destId: number;

      if (destinationTeamId !== undefined) {
        // Validate destination belongs to this org.
        const destTeam = await tx.team.findFirst({
          where: { id: destinationTeamId, organisationId },
          select: { id: true },
        });

        if (!destTeam) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Destination team was not found in this organisation.',
          });
        }

        // Lock the destination row to prevent concurrent merges into it.
        await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${destinationTeamId} AND "organisationId" = ${organisationId} FOR UPDATE`;

        destId = destinationTeamId;
      } else if (newTeamName !== undefined && newTeamUrl !== undefined) {
        // Create a new destination team inside the transaction.
        const teamSettings = await tx.teamGlobalSettings.create({
          data: {
            ...generateDefaultTeamSettings(),
            defaultRecipients: Prisma.DbNull,
            id: generateDatabaseId('team_setting'),
          },
        });

        const newTeam = await tx.team.create({
          data: {
            name: newTeamName,
            url: newTeamUrl,
            organisationId,
            teamGlobalSettingsId: teamSettings.id,
          },
        });

        destId = newTeam.id;
      } else {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Either destinationTeamId or both newTeamName and newTeamUrl must be provided.',
        });
      }

      // 4. Exclude destination from the deletion list.
      const sourceIds = sourceTeams.map((t) => t.id).filter((id) => id !== destId);

      if (sourceIds.length === 0) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'No source teams remaining after excluding the destination team.',
        });
      }

      // 5. Compute impact counts before destructive operations.
      const impact = await getMergeImpact(tx, sourceIds, destId);

      // 6. Reparent envelopes.
      await tx.envelope.updateMany({
        where: { teamId: { in: sourceIds } },
        data: { teamId: destId },
      });

      // 7. Reparent folders.
      await tx.folder.updateMany({
        where: { teamId: { in: sourceIds } },
        data: { teamId: destId },
      });

      // 8. Consolidate non-INTERNAL_TEAM member groups onto the destination.
      const sourceGroups = await tx.teamGroup.findMany({
        where: { teamId: { in: sourceIds } },
        include: { organisationGroup: { select: { type: true } } },
      });

      const nonInternalSourceGroups = sourceGroups.filter(
        (g) => g.organisationGroup.type !== OrganisationGroupType.INTERNAL_TEAM,
      );

      const uniqueOrgGroupIds = [
        ...new Set(nonInternalSourceGroups.map((g) => g.organisationGroupId)),
      ];

      if (uniqueOrgGroupIds.length > 0) {
        const existingDestGroups = await tx.teamGroup.findMany({
          where: { teamId: destId, organisationGroupId: { in: uniqueOrgGroupIds } },
          select: { organisationGroupId: true },
        });

        const existingOrgGroupIds = new Set(existingDestGroups.map((g) => g.organisationGroupId));

        const newGroupLinks = uniqueOrgGroupIds
          .filter((id) => !existingOrgGroupIds.has(id))
          .map((organisationGroupId) => ({
            id: generateDatabaseId('team_group'),
            teamId: destId,
            organisationGroupId,
            teamRole: TeamMemberRole.MEMBER,
          }));

        if (newGroupLinks.length > 0) {
          await tx.teamGroup.createMany({ data: newGroupLinks, skipDuplicates: true });
        }
      }

      // 9. Collect settings IDs from source teams before deletion.
      const settingsIds = sourceTeams
        .filter((t) => sourceIds.includes(t.id))
        .map((t) => t.teamGlobalSettingsId);

      // 10. Delete source teams.
      for (const id of sourceIds) {
        await tx.team.delete({ where: { id } });
      }

      // 11. Delete orphaned TeamGlobalSettings records.
      await tx.teamGlobalSettings.deleteMany({
        where: { id: { in: settingsIds } },
      });

      // 12. Clean up orphaned INTERNAL_TEAM OrganisationGroups.
      await tx.organisationGroup.deleteMany({
        where: {
          type: OrganisationGroupType.INTERNAL_TEAM,
          teamGroups: { none: {} },
        },
      });

      return impact;
    },
    { timeout: 30000 },
  );
};
