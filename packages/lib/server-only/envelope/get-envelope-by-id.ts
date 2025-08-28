import type { Prisma } from '@prisma/client';
import { EnvelopeType, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DocumentVisibility } from '../../types/document-visibility';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { buildEnvelopeIdQuery } from '../../utils/envelope';
import { getTeamById } from '../team/get-team';

export type GetEnvelopeByIdOptions = {
  id: EnvelopeIdOptions;

  /**
   * The validated team ID.
   */
  userId: number;

  /**
   * The unvalidated team ID.
   */
  teamId: number;
};

export const getEnvelopeById = async ({ id, userId, teamId }: GetEnvelopeByIdOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      documents: {
        include: {
          documentData: true,
        },
      },
      folder: true,
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: true,
      fields: true,
      team: {
        select: {
          id: true,
          url: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope could not be found',
    });
  }

  return envelope;
};

export type GetEnvelopeByIdResponse = Awaited<ReturnType<typeof getEnvelopeById>>;

export type GetEnvelopeWhereInputOptions = {
  id: EnvelopeIdOptions;

  /**
   * The user ID who has been authenticated.
   */
  userId: number;

  /**
   * The unknown teamId from the request.
   */
  teamId: number;
};

/**
 * Generate the where input for a given Prisma envelope query.
 *
 * This will return a query that allows a user to get a document if they have valid access to it.
 */
export const getEnvelopeWhereInput = async ({
  id,
  userId,
  teamId,
}: GetEnvelopeWhereInputOptions) => {
  const team = await getTeamById({ teamId, userId });

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
      userId,
    },
    // Or, if they belong to the team that the document is associated with.
    {
      visibility: {
        in: teamVisibilityFilters,
      },
      teamId: team.id,
    },
    // @@@@@@@@@@@@@@@@@@@@
    // @@@@@@@@@@@@@@@@@@@@
    // @@@@@@@@@@@@@@@@@@@@ recipient of documetn? should NOT be allowed
    // @@@@@@@@@@@@@@@@@@@@
    // @@@@@@@@@@@@@@@@@@@@
  ];

  // Allow access to documents sent to or from the team email.
  if (team.teamEmail) {
    documentOrInput.push(
      // @@@@@@@@@@@@@@@@@@@@@@
      // @@@@@@@@@@@@@@@@@@@@@@ SHOULD NOT BE ALLOWEd
      // @@@@@@@@@@@@@@@@@@@@@@ REQUIRES TESTING
      // @@@@@@@@@@@@@@@@@@@@@@ REQUIRES TESTING
      // @@@@@@@@@@@@@@@@@@@@@@ REQUIRES TESTING
      // @@@@@@@@@@@@@@@@@@@@@@ REQUIRES TESTING
      // @@@@@@@@@@@@@@@@@@@@@@
      // @@@@@@@@@@@@@@@@@@@@@@
      // {
      //   recipients: {
      //     some: {
      //       email: team.teamEmail.email,
      //     },
      //   },
      // },
      {
        user: {
          email: team.teamEmail.email,
        },
      },
    );
  }

  const envelopeWhereInput: Prisma.EnvelopeWhereUniqueInput = {
    ...buildEnvelopeIdQuery(id),
    type: id.type === 'templateId' ? EnvelopeType.TEMPLATE : EnvelopeType.DOCUMENT,
    OR: documentOrInput,
  };

  return {
    envelopeWhereInput,
    team,
  };
};
