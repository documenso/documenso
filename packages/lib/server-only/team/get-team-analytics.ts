import { prisma } from '@documenso/prisma';
import type {
  TGetTeamAnalyticsRequest,
  TGetTeamAnalyticsResponse,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { DocumentStatus, EnvelopeType, Prisma, TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

import { IS_TEAM_ANALYTICS_ENABLED } from '../../constants/app';
import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { resolveAnalyticsPeriod } from '../../utils/analytics-period';
import { buildTeamWhereQuery } from '../../utils/teams';

/** Inputs for a visibility-scoped team analytics query. */
export type GetTeamAnalyticsOptions = TGetTeamAnalyticsRequest & {
  userId: number;
};

const ZAnalyticsRowSchema = z.object({
  sent: z.bigint(),
  completed: z.bigint(),
  declined: z.bigint(),
  cancelled: z.bigint(),
  draft: z.bigint(),
  pending: z.bigint(),
  missingSent: z.boolean(),
  missingCompleted: z.boolean(),
  missingDeclined: z.boolean(),
  missingCancelled: z.boolean(),
  hasDocuments: z.boolean(),
  observedAt: z.date(),
});

const MAX_SAFE_COUNT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Read exact document activity and current-state counts from one database snapshot.
 */
export const getTeamAnalytics = async ({
  userId,
  teamId,
  period,
  date,
  timezone,
  senderIds: requestedSenderIds,
}: GetTeamAnalyticsOptions): Promise<TGetTeamAnalyticsResponse> => {
  if (!IS_TEAM_ANALYTICS_ENABLED()) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Team analytics is disabled',
    });
  }

  const resolvedPeriod = resolveAnalyticsPeriod({ period, date, timezone });
  const senderIds = [...new Set(requestedSenderIds ?? [])].sort((a, b) => a - b);

  return await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = 5000`;

      const team = await tx.team.findFirst({
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
            select: {
              teamRole: true,
            },
          },
        },
      });

      if (!team) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'You are not allowed to view analytics for this team',
        });
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      });

      const role = team.teamGroups.some(({ teamRole }) => teamRole === TeamMemberRole.ADMIN)
        ? TeamMemberRole.ADMIN
        : TeamMemberRole.MANAGER;
      const allowedVisibilities = TEAM_DOCUMENT_VISIBILITY_MAP[role];

      const visibleEnvelopeWhere: Prisma.EnvelopeWhereInput = {
        teamId: team.id,
        type: EnvelopeType.DOCUMENT,
        deletedAt: null,
        OR: [{ visibility: { in: allowedVisibilities } }, { userId }, { recipients: { some: { email: user.email } } }],
      };

      const owners = await tx.user.findMany({
        where: {
          OR: [
            {
              organisationMember: {
                some: {
                  organisationGroupMembers: {
                    some: {
                      group: {
                        teamGroups: {
                          some: { teamId: team.id },
                        },
                      },
                    },
                  },
                },
              },
            },
            {
              envelopes: {
                some: visibleEnvelopeWhere,
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
      });

      const ownerIds = new Set(owners.map(({ id }) => id));

      if (senderIds.some((senderId) => !ownerIds.has(senderId))) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Owner filter contains an unavailable owner',
        });
      }

      const ownerFilter =
        senderIds.length > 0 ? Prisma.sql`AND e."userId" IN (${Prisma.join(senderIds)})` : Prisma.sql``;

      const rows = ZAnalyticsRowSchema.array().parse(
        await tx.$queryRaw`
          WITH "scopedEnvelopes" AS (
            SELECT e.id, e.status
            FROM "Envelope" e
            WHERE e.type = ${EnvelopeType.DOCUMENT}::"EnvelopeType"
              AND e."teamId" = ${team.id}
              AND e."deletedAt" IS NULL
              AND (
                e.visibility IN (${Prisma.join(allowedVisibilities.map((visibility) => Prisma.sql`${visibility}::"DocumentVisibility"`))})
                OR e."userId" = ${userId}
                OR EXISTS (
                  SELECT 1
                  FROM "Recipient" r
                  WHERE r."envelopeId" = e.id
                    AND r.email = ${user.email}
                )
              )
              ${ownerFilter}
          ),
          "firstEvents" AS (
            SELECT
              log."envelopeId",
              MIN(log."createdAt") FILTER (
                WHERE log.type = ${DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT}
              ) AS "sentAt",
              MIN(log."createdAt") FILTER (
                WHERE log.type = ${DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED}
                  AND log.data ->> 'isRejected' IS DISTINCT FROM 'true'
              ) AS "completedAt",
              MIN(log."createdAt") FILTER (
                WHERE log.type = ${DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED}
              ) AS "declinedAt",
              MIN(log."createdAt") FILTER (
                WHERE log.type = ${DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CANCELLED}
              ) AS "cancelledAt"
            FROM "DocumentAuditLog" log
            INNER JOIN "scopedEnvelopes" envelope ON envelope.id = log."envelopeId"
            WHERE log.type IN (
              ${Prisma.join([
                DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
                DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
                DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED,
                DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CANCELLED,
              ])}
            )
            GROUP BY log."envelopeId"
          )
          SELECT
            COUNT(*) FILTER (
              WHERE event."sentAt" >= ${resolvedPeriod.start}
                AND event."sentAt" < ${resolvedPeriod.end}
            ) AS sent,
            COUNT(*) FILTER (
              WHERE event."completedAt" >= ${resolvedPeriod.start}
                AND event."completedAt" < ${resolvedPeriod.end}
            ) AS completed,
            COUNT(*) FILTER (
              WHERE event."declinedAt" >= ${resolvedPeriod.start}
                AND event."declinedAt" < ${resolvedPeriod.end}
            ) AS declined,
            COUNT(*) FILTER (
              WHERE event."cancelledAt" >= ${resolvedPeriod.start}
                AND event."cancelledAt" < ${resolvedPeriod.end}
            ) AS cancelled,
            COUNT(*) FILTER (WHERE envelope.status = ${DocumentStatus.DRAFT}::"DocumentStatus") AS draft,
            COUNT(*) FILTER (WHERE envelope.status = ${DocumentStatus.PENDING}::"DocumentStatus") AS pending,
            COALESCE(BOOL_OR(
              envelope.status <> ${DocumentStatus.DRAFT}::"DocumentStatus" AND event."sentAt" IS NULL
            ), false) AS "missingSent",
            COALESCE(BOOL_OR(
              envelope.status = ${DocumentStatus.COMPLETED}::"DocumentStatus" AND event."completedAt" IS NULL
            ), false) AS "missingCompleted",
            COALESCE(BOOL_OR(
              envelope.status = ${DocumentStatus.REJECTED}::"DocumentStatus" AND event."declinedAt" IS NULL
            ), false) AS "missingDeclined",
            COALESCE(BOOL_OR(
              envelope.status = ${DocumentStatus.CANCELLED}::"DocumentStatus" AND event."cancelledAt" IS NULL
            ), false) AS "missingCancelled",
            EXISTS (SELECT 1 FROM "scopedEnvelopes") AS "hasDocuments",
            CURRENT_TIMESTAMP AS "observedAt"
          FROM "scopedEnvelopes" envelope
          LEFT JOIN "firstEvents" event ON event."envelopeId" = envelope.id
        `,
      );

      const row = rows[0];

      if (!row) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Analytics query returned no result',
        });
      }

      const incompleteMetrics: TGetTeamAnalyticsResponse['incompleteMetrics'] = [];

      if (row.missingSent) {
        incompleteMetrics.push('sent');
      }
      if (row.missingCompleted) {
        incompleteMetrics.push('completed');
      }
      if (row.missingDeclined) {
        incompleteMetrics.push('declined');
      }
      if (row.missingCancelled) {
        incompleteMetrics.push('cancelled');
      }

      return {
        period: resolvedPeriod,
        senderIds,
        owners,
        activity: {
          sent: toCount(row.sent),
          completed: toCount(row.completed),
          declined: toCount(row.declined),
          cancelled: toCount(row.cancelled),
        },
        current: {
          draft: toCount(row.draft),
          pending: toCount(row.pending),
        },
        observedAt: row.observedAt,
        incompleteMetrics,
        hasDocuments: row.hasDocuments,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5000,
      timeout: 5000,
    },
  );
};

const toCount = (count: bigint): number => {
  if (count < 0n || count > MAX_SAFE_COUNT) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Analytics count exceeds the safe integer range',
    });
  }

  return Number(count);
};
