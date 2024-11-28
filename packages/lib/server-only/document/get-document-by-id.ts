import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';
import { TeamMemberRole } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DocumentVisibility } from '../../types/document-visibility';
import { getTeamById } from '../team/get-team';

export type GetDocumentByIdOptions = {
  id: number;
  userId: number;
  teamId?: number;
};

export const getDocumentById = async ({ id, userId, teamId }: GetDocumentByIdOptions) => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId: id,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    include: {
      documentData: true,
      documentMeta: true,
      User: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      Recipient: {
        select: {
          email: true,
        },
      },
      team: {
        select: {
          id: true,
          url: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document could not be found',
    });
  }

  return document;
};

export type GetDocumentWhereInputOptions = {
  documentId: number;
  userId: number;
  teamId?: number;

  /**
   * Whether to return a filter that allows access to both the user and team documents.
   * This only applies if `teamId` is passed in.
   *
   * If true, and `teamId` is passed in, the filter will allow both team and user documents.
   * If false, and `teamId` is passed in, the filter will only allow team documents.
   *
   * Defaults to false.
   */
  overlapUserTeamScope?: boolean;
};

/**
 * Generate the where input for a given Prisma document query.
 *
 * This will return a query that allows a user to get a document if they have valid access to it.
 */
export const getDocumentWhereInput = async ({
  documentId,
  userId,
  teamId,
  overlapUserTeamScope = false,
}: GetDocumentWhereInputOptions) => {
  const documentWhereInput: Prisma.DocumentWhereUniqueInput = {
    id: documentId,
    OR: [
      {
        userId,
      },
    ],
  };

  if (teamId === undefined || !documentWhereInput.OR) {
    return documentWhereInput;
  }

  const team = await getTeamById({ teamId, userId });

  // Allow access to team and user documents.
  if (overlapUserTeamScope) {
    documentWhereInput.OR.push({
      teamId: team.id,
    });
  }

  // Allow access to only team documents.
  if (!overlapUserTeamScope) {
    documentWhereInput.OR = [
      {
        teamId: team.id,
      },
    ];
  }

  // Allow access to documents sent to or from the team email.
  if (team.teamEmail) {
    documentWhereInput.OR.push(
      {
        Recipient: {
          some: {
            email: team.teamEmail.email,
          },
        },
      },
      {
        User: {
          email: team.teamEmail.email,
        },
      },
    );
  }

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const visibilityFilters = [
    ...match(team.currentTeamMember?.role)
      .with(TeamMemberRole.ADMIN, () => [
        { visibility: DocumentVisibility.EVERYONE },
        { visibility: DocumentVisibility.MANAGER_AND_ABOVE },
        { visibility: DocumentVisibility.ADMIN },
      ])
      .with(TeamMemberRole.MANAGER, () => [
        { visibility: DocumentVisibility.EVERYONE },
        { visibility: DocumentVisibility.MANAGER_AND_ABOVE },
      ])
      .otherwise(() => [{ visibility: DocumentVisibility.EVERYONE }]),
    {
      OR: [
        {
          Recipient: {
            some: {
              email: user.email,
            },
          },
        },
        {
          userId: user.id,
        },
      ],
    },
  ];

  return {
    ...documentWhereInput,
    OR: [...visibilityFilters],
  };
};
