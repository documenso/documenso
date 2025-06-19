import type { Prisma } from '@prisma/client';
import { DocumentStatus, TeamMemberRole } from '@prisma/client';
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

  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const teamVisibilityFilters = match(team.currentTeamRole)
    .with(TeamMemberRole.ADMIN, () => [
      DocumentVisibility.EVERYONE,
      DocumentVisibility.MANAGER_AND_ABOVE,
      DocumentVisibility.ADMIN,
    ])
    .with(TeamMemberRole.MANAGER, () => [
      DocumentVisibility.EVERYONE,
      DocumentVisibility.MANAGER_AND_ABOVE,
    ])
    .otherwise(() => [DocumentVisibility.EVERYONE]);

  const documentOrInput: Prisma.DocumentWhereInput[] = [
    // Allow access if they own the document.
    {
      userId,
    },
    // Or, if they belong to the team that the document is associated with.
    {
      visibility: {
        in: teamVisibilityFilters,
      },
      teamId,
    },
    // Or, if they are a recipient of the document.
    {
      status: {
        not: DocumentStatus.DRAFT,
      },
      recipients: {
        some: {
          email: user.email,
        },
      },
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

  return {
    documentWhereInput,
    team,
  };
};
