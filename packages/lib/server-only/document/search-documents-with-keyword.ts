import type { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentVisibility, EnvelopeType, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { formatDocumentsPath, getHighestTeamRoleInGroup } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { getUserTeamGroups } from '../team/get-user-team-groups';

export type SearchDocumentsWithKeywordOptions = {
  query: string;
  userId: number;
  limit?: number;
};

export const searchDocumentsWithKeyword = async ({
  query,
  userId,
  limit = 20,
}: SearchDocumentsWithKeywordOptions) => {
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

  const filters: Prisma.EnvelopeWhereInput[] = [
    // Documents owned by the user matching title, externalId, or recipient email.
    {
      userId,
      deletedAt: null,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { externalId: { contains: query, mode: 'insensitive' } },
        {
          recipients: {
            some: { email: { contains: query, mode: 'insensitive' } },
          },
        },
      ],
    },
    // Documents where the user is a recipient (completed or pending).
    {
      status: { in: [DocumentStatus.COMPLETED, DocumentStatus.PENDING] },
      recipients: { some: { email: user.email } },
      title: { contains: query, mode: 'insensitive' },
      deletedAt: null,
    },
  ];

  // Team documents the user has access to.
  if (teamIds.length > 0) {
    filters.push({
      teamId: { in: teamIds },
      deletedAt: null,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { externalId: { contains: query, mode: 'insensitive' } },
        {
          recipients: {
            some: { email: { contains: query, mode: 'insensitive' } },
          },
        },
      ],
    });
  }

  const envelopes = await prisma.envelope.findMany({
    where: {
      type: EnvelopeType.DOCUMENT,
      OR: filters,
    },
    select: {
      id: true,
      userId: true,
      teamId: true,
      title: true,
      secondaryId: true,
      visibility: true,
      recipients: {
        select: {
          email: true,
          token: true,
        },
      },
      team: {
        select: {
          url: true,
        },
      },
    },
    distinct: ['id'],
    orderBy: {
      createdAt: 'desc',
    },
    // Over-fetch to compensate for post-query visibility filtering on team documents.
    take: limit * 3,
  });

  const results = envelopes
    .filter((envelope) => {
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
      const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      let path: string;

      if (
        envelope.userId === user.id ||
        (envelope.teamId && teamGroupsByTeamId.has(envelope.teamId))
      ) {
        path = `${formatDocumentsPath(envelope.team.url)}/${legacyDocumentId}`;
      } else {
        const signingToken = envelope.recipients.find((r) => r.email === user.email)?.token;
        path = `/sign/${signingToken}`;
      }

      return {
        title: envelope.title,
        path,
        value: [envelope.id, envelope.title, ...envelope.recipients.map((r) => r.email)].join(' '),
      };
    });

  return results;
};
