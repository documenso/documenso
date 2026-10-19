import { prisma, sql } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';
import { EnvelopeType, OrganisationMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import type { ApplyEnvelopeScope } from '../team/get-team-analytics-scope';

export type GetOrganisationAnalyticsScopeOptions = {
  organisationId: string;
  userId: number;
};

/**
 * Authorise the caller for organisation analytics (organisation ADMIN only) and
 * build the envelope scope used by every organisation analytics procedure.
 *
 * The organisation ADMIN role authorises organisation-wide visibility. The internal
 * ADMIN group is attached to every team by `createTeam` and cannot be detached, so
 * every non-deleted document across the organisation's teams is in scope and no
 * per-document visibility filtering is applied.
 */
export const getOrganisationAnalyticsScope = async ({
  organisationId,
  userId,
}: GetOrganisationAnalyticsScopeOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: [OrganisationMemberRole.ADMIN],
    }),
    select: {
      id: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You are not allowed to view analytics for this organisation',
    });
  }

  const envelopeWhere: Prisma.EnvelopeWhereInput = {
    team: {
      organisationId: organisation.id,
    },
    type: EnvelopeType.DOCUMENT,
    deletedAt: null,
  };

  /**
   * Kysely predicate equivalent of `envelopeWhere`, for use in `Envelope` queries
   * that need aggregates Prisma cannot express.
   */
  const applyEnvelopeScope: ApplyEnvelopeScope = (eb) =>
    eb.and([
      eb('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT)),
      eb('Envelope.deletedAt', 'is', null),
      eb(
        'Envelope.teamId',
        'in',
        eb.selectFrom('Team').select('Team.id').where('Team.organisationId', '=', organisation.id),
      ),
    ]);

  return {
    organisationId: organisation.id,
    userId,
    envelopeWhere,
    applyEnvelopeScope,
  };
};

export type OrganisationAnalyticsScope = Awaited<ReturnType<typeof getOrganisationAnalyticsScope>>;

export type OrganisationAnalyticsTeam = {
  id: number;
  name: string;
  url: string;
  avatarImageId: string | null;
};

/**
 * Every team in the organisation, sorted by name.
 */
export const getOrganisationAnalyticsTeams = async (organisationId: string): Promise<OrganisationAnalyticsTeam[]> => {
  const teams = await prisma.team.findMany({
    where: {
      organisationId,
    },
    select: {
      id: true,
      name: true,
      url: true,
      avatarImageId: true,
    },
  });

  return teams.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
};
