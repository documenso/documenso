import type { EnvelopeType, Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdsOptions } from '../../utils/envelope';
import { unsafeBuildEnvelopeIdsQuery } from '../../utils/envelope';
import { getTeamById } from '../team/get-team';

export type GetEnvelopesByIdsOptions = {
  /**
   * The envelope IDs to fetch with their type.
   */
  ids: EnvelopeIdsOptions;

  /**
   * The user ID who has been authenticated.
   */
  userId: number;

  /**
   * The unvalidated team ID from the request.
   */
  teamId: number;

  /**
   * The type of envelope to get.
   *
   * Set to null to bypass check.
   */
  type: EnvelopeType | null;
};

/**
 * Fetches multiple envelopes by their IDs with proper access control.
 *
 * Only returns envelopes that the user has valid access to based on:
 * 1. Document ownership (userId matches)
 * 2. Team membership with appropriate visibility level
 * 3. Team email ownership
 *
 * NOTE: Be extremely careful when modifying this function. Needs at minimum two reviewers to approve any changes.
 */
export const getEnvelopesByIds = async ({
  ids,
  userId,
  teamId,
  type,
}: GetEnvelopesByIdsOptions) => {
  const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
    ids,
    userId,
    teamId,
    type,
  });

  const envelopes = await prisma.envelope.findMany({
    where: envelopeWhereInput,
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
        orderBy: {
          order: 'asc',
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
      recipients: {
        orderBy: {
          id: 'asc',
        },
      },
      fields: true,
      team: {
        select: {
          id: true,
          url: true,
        },
      },
      directLink: {
        select: {
          directTemplateRecipientId: true,
          enabled: true,
          id: true,
          token: true,
        },
      },
    },
  });

  return envelopes.map((envelope) => ({
    ...envelope,
    user: {
      id: envelope.user.id,
      name: envelope.user.name || '',
      email: envelope.user.email,
    },
  }));
};

export type GetEnvelopesByIdsResponse = Awaited<ReturnType<typeof getEnvelopesByIds>>;

export type GetMultipleEnvelopeWhereInputOptions = {
  /**
   * The envelope IDs to fetch with their type.
   */
  ids: EnvelopeIdsOptions;

  /**
   * The user ID who has been authenticated.
   */
  userId: number;

  /**
   * The unknown teamId from the request.
   */
  teamId: number;

  /**
   * The type of envelope to get.
   *
   * Set to null to bypass check.
   */
  type: EnvelopeType | null;
};

/**
 * Generate the where input for a multiple envelope Prisma query.
 *
 * This will return a query that allows a user to get documents if they have valid access to them.
 *
 * NOTE: Be extremely careful when modifying this function. Needs at minimum two reviewers to approve any changes.
 */
export const getMultipleEnvelopeWhereInput = async ({
  ids,
  userId,
  teamId,
  type,
}: GetMultipleEnvelopeWhereInputOptions) => {
  // Backup validation incase something goes wrong.
  if (!ids.ids || !userId || !teamId || type === undefined) {
    console.error(`[CRTICAL ERROR]: MUST NEVER HAPPEN`);

    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope IDs not found',
    });
  }

  // Validate that the user belongs to the team provided.
  const team = await getTeamById({ teamId, userId });

  const envelopeOrInput: Prisma.EnvelopeWhereInput[] = [
    // Allow access if they own the document.
    {
      userId,
    },
    // Or, if they belong to the team that the document is associated with.
    {
      visibility: {
        in: TEAM_DOCUMENT_VISIBILITY_MAP[team.currentTeamRole],
      },
      teamId: team.id,
    },
  ];

  // Allow access to documents sent from the team email.
  if (team.teamEmail) {
    envelopeOrInput.push({
      user: {
        email: team.teamEmail.email,
      },
    });
  }

  // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  // NOTE: DO NOT PUT ANY CODE AFTER THIS POINT.
  // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

  const envelopeWhereInput: Prisma.EnvelopeWhereInput = {
    ...unsafeBuildEnvelopeIdsQuery(ids, type),
    OR: envelopeOrInput,
  };

  // Final backup validation incase something goes wrong.
  if (
    !envelopeWhereInput.OR ||
    envelopeWhereInput.OR.length < 2 ||
    !userId ||
    !teamId ||
    !team.id ||
    teamId !== team.id
  ) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Query not valid',
    });
  }

  // Do not modify this return directly, all adjustments need to be made prior to the above if statement.
  return {
    envelopeWhereInput,
    team,
  };
};
