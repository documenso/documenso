import { match } from 'ts-pattern';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';
import type { Document, Recipient, User } from '@documenso/prisma/client';
import { DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';

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
          Recipient: {
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
          Recipient: {
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
          Recipient: {
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
          teamId: {
            not: null,
          },
          team: {
            members: {
              some: {
                userId: userId,
              },
            },
          },
          deletedAt: null,
        },
      ],
    },
    include: {
      Recipient: true,
      team: {
        select: {
          url: true,
          members: {
            where: {
              userId: userId,
            },
            select: {
              role: true,
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

      const teamMemberRole = document.team?.members[0]?.role;

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
      const { Recipient, ...documentWithoutRecipient } = document;

      let documentPath;

      if (isOwner(document, user)) {
        documentPath = `${formatDocumentsPath(document.team?.url)}/${document.id}`;
      } else if (document.teamId && document.team) {
        documentPath = `${formatDocumentsPath(document.team.url)}/${document.id}`;
      } else {
        documentPath = getSigningLink(Recipient, user);
      }

      return {
        ...documentWithoutRecipient,
        path: documentPath,
        value: [document.id, document.title, ...document.Recipient.map((r) => r.email)].join(' '),
      };
    });

  return maskedDocuments;
};
