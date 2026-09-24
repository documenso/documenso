import { prisma, sql } from '@documenso/prisma';
import type { DB } from '@documenso/prisma/generated/types';
import type { Prisma } from '@prisma/client';
import { EnvelopeType, TeamMemberRole } from '@prisma/client';
import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery, getHighestTeamRoleInGroup } from '../../utils/teams';

export type GetTeamAnalyticsScopeOptions = {
  teamId: number;
  userId: number;
  userEmail: string;
};

export type EnvelopeScopeExpressionBuilder = ExpressionBuilder<DB, 'Envelope'>;

export type ApplyEnvelopeScope = (eb: EnvelopeScopeExpressionBuilder) => Expression<SqlBool>;

/**
 * Authorise the caller for team analytics (ADMIN or MANAGER) and build the
 * envelope visibility scope used by every analytics procedure.
 *
 * The visibility rule mirrors `findDocuments`: an envelope is visible when its
 * visibility meets the caller's role threshold, the caller owns it, or the caller
 * is a recipient. Only non-deleted team documents are considered.
 */
export const getTeamAnalyticsScope = async ({ teamId, userId, userEmail }: GetTeamAnalyticsScopeOptions) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: [TeamMemberRole.ADMIN, TeamMemberRole.MANAGER],
    }),
    select: {
      id: true,
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
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You are not allowed to view analytics for this team',
    });
  }

  const role = getHighestTeamRoleInGroup(team.teamGroups);
  const allowedVisibilities = TEAM_DOCUMENT_VISIBILITY_MAP[role];

  const envelopeWhere: Prisma.EnvelopeWhereInput = {
    teamId: team.id,
    type: EnvelopeType.DOCUMENT,
    deletedAt: null,
    OR: [{ visibility: { in: allowedVisibilities } }, { userId }, { recipients: { some: { email: userEmail } } }],
  };

  /**
   * Kysely predicate equivalent of `envelopeWhere`, for use in `Envelope` queries
   * that need aggregates Prisma cannot express.
   */
  const applyEnvelopeScope: ApplyEnvelopeScope = (eb) =>
    eb.and([
      eb('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT)),
      eb('Envelope.teamId', '=', team.id),
      eb('Envelope.deletedAt', 'is', null),
      eb.or([
        eb(
          'Envelope.visibility',
          'in',
          allowedVisibilities.map((visibility) => sql.lit(visibility)),
        ),
        eb('Envelope.userId', '=', userId),
        eb.exists(
          eb
            .selectFrom('Recipient')
            .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
            .where('Recipient.email', '=', userEmail)
            .select(sql.lit(1).as('one')),
        ),
      ]),
    ]);

  return {
    teamId: team.id,
    userId,
    userEmail,
    role,
    allowedVisibilities,
    envelopeWhere,
    applyEnvelopeScope,
  };
};

export type TeamAnalyticsScope = Awaited<ReturnType<typeof getTeamAnalyticsScope>>;

export type TeamAnalyticsMember = {
  id: number;
  name: string | null;
  email: string;
  avatarImageId: string | null;
};

/**
 * Distinct users who are current members of the team (attached through any of
 * the team's organisation groups).
 */
export const getTeamAnalyticsMembers = async (teamId: number): Promise<TeamAnalyticsMember[]> => {
  const members = await prisma.organisationMember.findMany({
    where: {
      organisationGroupMembers: {
        some: {
          group: {
            teamGroups: {
              some: {
                teamId,
              },
            },
          },
        },
      },
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarImageId: true,
        },
      },
    },
  });

  const membersByUserId = new Map<number, TeamAnalyticsMember>();

  for (const member of members) {
    if (!membersByUserId.has(member.user.id)) {
      membersByUserId.set(member.user.id, member.user);
    }
  }

  return Array.from(membersByUserId.values());
};

/**
 * Completion percentage (0-100) rounded to one decimal, or null when nothing was sent.
 */
export const calculateTeamAnalyticsCompletionRate = ({
  completed,
  sent,
}: {
  completed: number;
  sent: number;
}): number | null => {
  if (sent === 0) {
    return null;
  }

  return Math.round((completed / sent) * 1000) / 10;
};

const MAX_SAFE_COUNT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Convert a Postgres COUNT into a JS number, throwing if the value cannot be
 * represented safely.
 *
 * Depending on the driver, Kysely surfaces `bigint` columns as `bigint`, `string`
 * or `number`, so all three are normalised here.
 */
export const toTeamAnalyticsCount = (count: string | number | bigint): number => {
  let value: bigint;

  try {
    value = BigInt(count);
  } catch {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Analytics count is not an integer',
    });
  }

  if (value < BigInt(0) || value > MAX_SAFE_COUNT) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Analytics count exceeds the safe integer range',
    });
  }

  return Number(value);
};
