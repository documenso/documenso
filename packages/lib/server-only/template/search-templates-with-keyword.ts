import { EnvelopeType } from '@prisma/client';
import type { Envelope, User } from '@prisma/client';
import { DocumentVisibility, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import {
  buildTeamWhereQuery,
  formatTemplatesPath,
  getHighestTeamRoleInGroup,
} from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { mapSecondaryIdToTemplateId } from '../../utils/envelope';

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

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const envelopes = await prisma.envelope.findMany({
    where: {
      type: EnvelopeType.TEMPLATE,
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive',
          },
          userId: userId,
          deletedAt: null,
        },
        {
          recipients: {
            some: {
              email: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
          userId: userId,
          deletedAt: null,
        },
        {
          title: {
            contains: query,
            mode: 'insensitive',
          },
          team: buildTeamWhereQuery({ teamId: undefined, userId }),
          deletedAt: null,
        },
      ],
    },
    include: {
      recipients: true,
      team: {
        select: {
          url: true,
          teamGroups: {
            where: {
              organisationGroup: {
                organisationGroupMembers: {
                  some: {
                    organisationMember: {
                      userId,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    distinct: ['id'],
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  const isOwner = (envelope: Envelope, user: User) => envelope.userId === user.id;

  const filteredTemplates = envelopes
    .filter((envelope) => {
      if (!envelope.teamId || isOwner(envelope, user)) {
        return true;
      }

      const teamMemberRole = getHighestTeamRoleInGroup(
        envelope.team.teamGroups.filter((tg) => tg.teamId === envelope.teamId),
      );

      if (!teamMemberRole) {
        return false;
      }

      const canAccessTemplate = match([envelope.visibility, teamMemberRole])
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MEMBER], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.ADMIN, TeamMemberRole.ADMIN], () => true)
        .otherwise(() => false);

      return canAccessTemplate;
    })
    .map((envelope) => {
      const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);
      const templatePath = `${formatTemplatesPath(envelope.team.url)}/${legacyTemplateId}`;

      return {
        title: envelope.title,
        path: templatePath,
        value: [envelope.id, envelope.title, ...envelope.recipients.map((r) => r.email)].join(' '),
      };
    });

  return filteredTemplates;
};
