import { DocumentStatus, EnvelopeType } from '@prisma/client';
import type { Envelope, Recipient, User } from '@prisma/client';
import { DocumentVisibility, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import {
  buildTeamWhereQuery,
  formatDocumentsPath,
  getHighestTeamRoleInGroup,
} from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { mapSecondaryIdToDocumentId } from '../../utils/envelope';

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
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const envelopes = await prisma.envelope.findMany({
    where: {
      type: EnvelopeType.DOCUMENT,
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
          externalId: {
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
          status: DocumentStatus.COMPLETED,
          recipients: {
            some: {
              email: user.email,
            },
          },
          title: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          status: DocumentStatus.PENDING,
          recipients: {
            some: {
              email: user.email,
            },
          },
          title: {
            contains: query,
            mode: 'insensitive',
          },
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
        {
          externalId: {
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

  const getSigningLink = (recipients: Recipient[], user: User) =>
    `/sign/${recipients.find((r) => r.email === user.email)?.token}`;

  const maskedDocuments = envelopes
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

      const canAccessDocument = match([envelope.visibility, teamMemberRole])
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MEMBER], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.ADMIN, TeamMemberRole.ADMIN], () => true)
        .otherwise(() => false);

      return canAccessDocument;
    })
    .map((envelope) => {
      const { recipients, ...documentWithoutRecipient } = envelope;

      let documentPath;

      const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

      if (isOwner(envelope, user)) {
        documentPath = `${formatDocumentsPath(envelope.team.url)}/${legacyDocumentId}`;
      } else if (envelope.teamId && envelope.team.teamGroups.length > 0) {
        documentPath = `${formatDocumentsPath(envelope.team.url)}/${legacyDocumentId}`;
      } else {
        documentPath = getSigningLink(recipients, user);
      }

      return {
        ...documentWithoutRecipient,
        team: {
          id: envelope.teamId,
          url: envelope.team.url,
        },
        path: documentPath,
        value: [envelope.id, envelope.title, ...envelope.recipients.map((r) => r.email)].join(' '),
      };
    });

  return maskedDocuments;
};
