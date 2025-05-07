import { DocumentStatus } from '@prisma/client';
import type { Document, Recipient, User } from '@prisma/client';
import { DocumentVisibility, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import {
  buildTeamWhereQuery,
  formatDocumentsPath,
  getHighestTeamRoleInGroup,
} from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

export type SearchDocumentsWithKeywordOptions = {
  query: string;
  userId: number;
  limit?: number;
};

export const searchDocumentsWithKeyword = async ({
  query,
  userId,
  limit = 5,
}: SearchDocumentsWithKeywordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const documents = await prisma.document.findMany({
    where: {
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
          team: buildTeamWhereQuery(undefined, userId),
          deletedAt: null,
        },
        {
          externalId: {
            contains: query,
            mode: 'insensitive',
          },
          team: buildTeamWhereQuery(undefined, userId),
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
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  const isOwner = (document: Document, user: User) => document.userId === user.id;
  const getSigningLink = (recipients: Recipient[], user: User) =>
    `/sign/${recipients.find((r) => r.email === user.email)?.token}`;

  const maskedDocuments = documents
    .filter((document) => {
      if (!document.teamId || isOwner(document, user)) {
        return true;
      }

      // Todo: Orgs test.
      const teamMemberRole = getHighestTeamRoleInGroup(document.team.teamGroups);

      if (!teamMemberRole) {
        return false;
      }

      const canAccessDocument = match([document.visibility, teamMemberRole])
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.EVERYONE, TeamMemberRole.MEMBER], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.ADMIN], () => true)
        .with([DocumentVisibility.MANAGER_AND_ABOVE, TeamMemberRole.MANAGER], () => true)
        .with([DocumentVisibility.ADMIN, TeamMemberRole.ADMIN], () => true)
        .otherwise(() => false);

      return canAccessDocument;
    })
    .map((document) => {
      const { recipients, ...documentWithoutRecipient } = document;

      let documentPath;

      if (isOwner(document, user)) {
        documentPath = `${formatDocumentsPath(document.team?.url)}/${document.id}`;
      } else if (document.teamId && document.team) {
        documentPath = `${formatDocumentsPath(document.team.url)}/${document.id}`;
      } else {
        documentPath = getSigningLink(recipients, user);
      }

      return {
        ...documentWithoutRecipient,
        path: documentPath,
        value: [document.id, document.title, ...document.recipients.map((r) => r.email)].join(' '),
      };
    });

  return maskedDocuments;
};
