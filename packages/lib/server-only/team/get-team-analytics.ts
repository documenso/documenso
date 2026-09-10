import { kyselyPrisma, prisma, sql } from '@documenso/prisma';
import type { DB } from '@documenso/prisma/generated/types';
import { DocumentStatus, EnvelopeType, TeamMemberRole } from '@prisma/client';
import type { ExpressionBuilder, SelectQueryBuilder } from 'kysely';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { getTeamById } from './get-team';

// Kysely query builder type for Envelope queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnvelopeQueryBuilder = SelectQueryBuilder<DB, 'Envelope', any>;

// Expression builder scoped to the Envelope table context.
type EnvelopeExpressionBuilder = ExpressionBuilder<DB, 'Envelope'>;

export type GetTeamAnalyticsOptions = {
  userId: number;
  teamId: number;
  periodStart: Date;
  periodEnd: Date;
  senderIds?: number[];
};

export type TeamAnalytics = {
  sent: number;
  draft: number;
  pending: number;
  completed: number;
  declined: number;
};

/**
 * Compute team document-usage analytics for a `[periodStart, periodEnd)` range.
 *
 * Each metric counts documents that ENTERED its state during the period, on its
 * own date axis (see the Documenso team analytics spec):
 *
 * - `sent`      — non-draft documents created in the period.
 * - `draft`     — documents still in draft, created in the period.
 * - `pending`   — documents still pending, created in the period.
 * - `completed` — completed documents whose `completedAt` falls in the period.
 * - `declined`  — rejected documents with a `DOCUMENT_RECIPIENT_REJECTED` audit
 *                 log entry in the period (there is no `Envelope.rejectedAt`).
 *
 * The tiles do NOT sum to `sent`: a document sent in one month but completed the
 * next lands in that next month's `completed`, never the first month's `sent`.
 *
 * Scope mirrors the established team document patterns (`EnvelopeType.DOCUMENT`,
 * `deletedAt IS NULL`, team `visibilityFilter`) but is limited to documents the
 * team PRODUCES (`teamId` + owner attribution). Inbox / documents received via a
 * team email are intentionally excluded. All folders are aggregated. Counts are
 * exact `COUNT(*)` — the `STATS_COUNT_CAP` used by `getStats` is not applied.
 */
export const getTeamAnalytics = async ({
  userId,
  teamId,
  periodStart,
  periodEnd,
  senderIds,
}: GetTeamAnalyticsOptions): Promise<TeamAnalytics> => {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { id: true, email: true },
  });

  const team = await getTeamById({ userId, teamId });

  const currentTeamRole = team.currentTeamRole ?? TeamMemberRole.MEMBER;
  const allowedVisibilities = TEAM_DOCUMENT_VISIBILITY_MAP[currentTeamRole];

  // Visibility: the viewer can see documents within their allowed visibilities,
  // documents they own, or documents they are a recipient of.
  const visibilityFilter = (eb: EnvelopeExpressionBuilder) =>
    eb.or([
      eb(
        'Envelope.visibility',
        'in',
        allowedVisibilities.map((visibility) => sql.lit(visibility)),
      ),
      eb('Envelope.userId', '=', user.id),
      eb.exists(
        eb
          .selectFrom('Recipient')
          .whereRef('Recipient.envelopeId', '=', 'Envelope.id')
          .where('Recipient.email', '=', user.email)
          .select(sql.lit(1).as('one')),
      ),
    ]);

  // Base query: team-produced, non-deleted documents across all folders.
  const buildBaseQuery = (): EnvelopeQueryBuilder => {
    let qb: EnvelopeQueryBuilder = kyselyPrisma.$kysely
      .selectFrom('Envelope')
      .where('Envelope.type', '=', sql.lit(EnvelopeType.DOCUMENT))
      .where('Envelope.teamId', '=', team.id)
      .where('Envelope.deletedAt', 'is', null)
      .where(visibilityFilter);

    if (senderIds && senderIds.length > 0) {
      qb = qb.where('Envelope.userId', 'in', senderIds);
    }

    return qb;
  };

  const countEnvelopes = async (qb: EnvelopeQueryBuilder): Promise<number> => {
    const result = await qb.select(({ fn }) => fn.count<number>('Envelope.id').as('count')).executeTakeFirstOrThrow();

    return Number(result.count ?? 0);
  };

  // Documents Sent: any non-draft document created in the period.
  const sentQuery = buildBaseQuery()
    .where('Envelope.status', '!=', sql.lit(DocumentStatus.DRAFT))
    .where('Envelope.createdAt', '>=', periodStart)
    .where('Envelope.createdAt', '<', periodEnd);

  // Draft: created in the period, still a draft.
  const draftQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.DRAFT))
    .where('Envelope.createdAt', '>=', periodStart)
    .where('Envelope.createdAt', '<', periodEnd);

  // Pending: created in the period, still pending.
  const pendingQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.PENDING))
    .where('Envelope.createdAt', '>=', periodStart)
    .where('Envelope.createdAt', '<', periodEnd);

  // Completed: completed in the period (completedAt is a distinct date axis).
  const completedQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.COMPLETED))
    .where('Envelope.completedAt', '>=', periodStart)
    .where('Envelope.completedAt', '<', periodEnd);

  // Declined: rejected documents whose rejection was logged in the period.
  const declinedQuery = buildBaseQuery()
    .where('Envelope.status', '=', sql.lit(DocumentStatus.REJECTED))
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom('DocumentAuditLog')
          .whereRef('DocumentAuditLog.envelopeId', '=', 'Envelope.id')
          .where('DocumentAuditLog.type', '=', DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED)
          .where('DocumentAuditLog.createdAt', '>=', periodStart)
          .where('DocumentAuditLog.createdAt', '<', periodEnd)
          .select(sql.lit(1).as('one')),
      ),
    );

  const [sent, draft, pending, completed, declined] = await Promise.all([
    countEnvelopes(sentQuery),
    countEnvelopes(draftQuery),
    countEnvelopes(pendingQuery),
    countEnvelopes(completedQuery),
    countEnvelopes(declinedQuery),
  ]);

  return {
    sent,
    draft,
    pending,
    completed,
    declined,
  };
};
