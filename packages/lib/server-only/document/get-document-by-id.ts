import type { Prisma } from '@prisma/client';
import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DocumentVisibility } from '../../types/document-visibility';
import { getTeamById } from '../team/get-team';

export type GetDocumentByIdOptions = {
  documentId: number;
  userId: number;
  teamId: number;
  folderId?: string;
};

export const getDocumentById = async ({
  documentId,
  userId,
  teamId,
  folderId,
}: GetDocumentByIdOptions) => {
  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: {
      ...documentWhereInput,
      folderId,
    },
    include: {
      documentData: true,
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: {
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
  teamId: number;
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
}: GetDocumentWhereInputOptions) => {
  const team = await getTeamById({ teamId, userId });

  const documentOrInput: Prisma.DocumentWhereInput[] = [
    {
      teamId: team.id,
    },
  ];

  // Allow access to documents sent to or from the team email.
  if (team.teamEmail) {
    documentOrInput.push(
      {
        recipients: {
          some: {
            email: team.teamEmail.email,
          },
        },
      },
      {
        user: {
          email: team.teamEmail.email,
        },
      },
    );
  }

  const documentWhereInput: Prisma.DocumentWhereUniqueInput = {
    id: documentId,
    OR: documentOrInput,
  };

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  // Todo: orgs test this
  const visibilityFilters = [
    ...match(team.currentTeamRole)
      .with(TeamMemberRole.ADMIN, () => [
        // Is this even needed?
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
          recipients: {
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
    documentWhereInput: {
      ...documentWhereInput,
      OR: [...visibilityFilters],
    },
    team,
  };
};
