import type { Prisma } from '@prisma/client';
import { DocumentVisibility, EnvelopeType, TeamMemberRole, TemplateType } from '@prisma/client';
import { match } from 'ts-pattern';

import { formatTemplatesPath, getHighestTeamRoleInGroup } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { mapSecondaryIdToTemplateId } from '../../utils/envelope';
import { getUserTeamGroups } from '../team/get-user-team-groups';

export type SearchTemplatesWithKeywordOptions = {
  query: string;
  userId: number;
  limit?: number;
};

export const searchTemplatesWithKeyword = async ({
  query,
  userId,
  limit = 20,
}: SearchTemplatesWithKeywordOptions) => {
  if (!query.trim()) {
    return [];
  }

  const [user, teamGroupsByTeamId] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
    }),
    getUserTeamGroups({ userId }),
  ]);

  const teamIds = [...teamGroupsByTeamId.keys()];

  const titleOrRecipientMatch: Prisma.EnvelopeWhereInput = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      {
        recipients: {
          some: { email: { contains: query, mode: 'insensitive' } },
        },
      },
    ],
  };

  const filters: Prisma.EnvelopeWhereInput[] = [
    // Templates owned by the user matching title or recipient email.
    {
      userId,
      deletedAt: null,
      ...titleOrRecipientMatch,
    },
  ];

  const orgIdToUserTeamUrl = new Map<string, string>();

  // Team templates the user has access to.
  if (teamIds.length > 0) {
    filters.push({
      teamId: { in: teamIds },
      deletedAt: null,
      ...titleOrRecipientMatch,
    });

    // ORGANISATION templates from sibling teams in the same org.
    const userTeams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, url: true, organisationId: true },
    });

    const orgIds = [...new Set(userTeams.map((t) => t.organisationId))];

    for (const t of userTeams) {
      if (!orgIdToUserTeamUrl.has(t.organisationId)) {
        orgIdToUserTeamUrl.set(t.organisationId, t.url);
      }
    }

    if (orgIds.length > 0) {
      filters.push({
        templateType: TemplateType.ORGANISATION,
        deletedAt: null,
        team: { organisationId: { in: orgIds } },
        ...titleOrRecipientMatch,
      });
    }
  }

  const envelopes = await prisma.envelope.findMany({
    where: {
      type: EnvelopeType.TEMPLATE,
      OR: filters,
    },
    select: {
      id: true,
      userId: true,
      teamId: true,
      title: true,
      secondaryId: true,
      visibility: true,
      templateType: true,
      recipients: {
        select: {
          email: true,
        },
      },
      team: {
        select: {
          id: true,
          url: true,
          organisationId: true,
        },
      },
    },
    distinct: ['id'],
    orderBy: {
      createdAt: 'desc',
    },
    // Over-fetch to compensate for post-query visibility filtering on team templates.
    take: limit * 3,
  });

  const results = envelopes
    .filter((envelope) => {
      // ORGANISATION templates are visible to all org members.
      if (envelope.templateType === TemplateType.ORGANISATION) {
        return true;
      }

      if (!envelope.teamId || envelope.userId === user.id) {
        return true;
      }

      const teamGroups = teamGroupsByTeamId.get(envelope.teamId) ?? [];
      const teamMemberRole = getHighestTeamRoleInGroup(teamGroups);

      if (!teamMemberRole) {
        return false;
      }

      return match([envelope.visibility, teamMemberRole])
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MEMBER], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.ADMIN, TeamMemberRole.ADMIN], () => true)
        .otherwise(() => false);
    })
    .slice(0, limit)
    .map((envelope) => {
      const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);

      const isOrgTemplateFromSiblingTeam =
        envelope.templateType === TemplateType.ORGANISATION &&
        !teamGroupsByTeamId.has(envelope.team.id);

      const teamUrl = isOrgTemplateFromSiblingTeam
        ? (orgIdToUserTeamUrl.get(envelope.team.organisationId) ?? envelope.team.url)
        : envelope.team.url;

      const path = `${formatTemplatesPath(teamUrl)}/${legacyTemplateId}`;

      return {
        title: envelope.title,
        path,
        value: [envelope.id, envelope.title, ...envelope.recipients.map((r) => r.email)].join(' '),
      };
    });

  return results;
};
