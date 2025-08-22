import type { Prisma } from '@prisma/client';
import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DocumentVisibility } from '../../types/document-visibility';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { buildEnvelopeIdQuery } from '../../utils/envelope';
import { getTeamById } from '../team/get-team';

export type GetEnvelopeByIdOptions = {
  id: EnvelopeIdOptions;

  userId: number;
  teamId: number;
};

export const getEnvelopeById = async ({ id, userId, teamId }: GetEnvelopeByIdOptions) => {
  const { documentWhereInput } = await getEnvelopeWhereInput({
    id,
    validatedUserId: userId,
    unvalidatedTeamId: teamId,
  });

  const document = await prisma.envelope.findFirst({
    where: documentWhereInput,
    include: {
      documents: {
        include: {
          documentData: true,
        },
      },
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

export type GetEnvelopeWhereInputOptions = {
  id: EnvelopeIdOptions;

  /**
   * The user ID who has been authenticated.
   */
  validatedUserId: number;

  /**
   * The unknown teamId from the request.
   */
  unvalidatedTeamId: number;
};

/**
 * Generate the where input for a given Prisma envelope query.
 *
 * This will return a query that allows a user to get a document if they have valid access to it.
 */
export const getEnvelopeWhereInput = async ({
  id,
  validatedUserId,
  unvalidatedTeamId,
}: GetEnvelopeWhereInputOptions) => {
  const team = await getTeamById({ teamId: unvalidatedTeamId, userId: validatedUserId });

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

  const documentOrInput: Prisma.EnvelopeWhereInput[] = [
    // Allow access if they own the document.
    {
      userId: validatedUserId,
    },
    // Or, if they belong to the team that the document is associated with.
    {
      visibility: {
        in: teamVisibilityFilters,
      },
      teamId: team.id,
    },
    // Or, if they are a recipient of the document.
    // ????????????? should recipients be able to do X?
    // {
    //   status: {
    //     not: DocumentStatus.DRAFT,
    //   },
    //   recipients: {
    //     some: {
    //       email: user.email,
    //     },
    //   },
    // },
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

  const documentWhereInput: Prisma.EnvelopeWhereUniqueInput = {
    ...buildEnvelopeIdQuery(id),
    OR: documentOrInput,
  };

  return {
    documentWhereInput,
    team,
  };
};
