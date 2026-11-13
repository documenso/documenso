import { kyselyPrisma, sql } from '@documenso/prisma';
import type {
  TGetTeamAnalyticsOverviewRequest,
  TGetTeamAnalyticsOverviewResponse,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { DocumentStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import {
  calculateTeamAnalyticsCompletionRate,
  getTeamAnalyticsMembers,
  getTeamAnalyticsScope,
  toTeamAnalyticsCount,
} from './get-team-analytics-scope';

export type GetTeamAnalyticsOverviewOptions = TGetTeamAnalyticsOverviewRequest & {
  userId: number;
  userEmail: string;
};

/**
 * Headline team analytics: documents sent, completion rate and member activity
 * for the requested window and the window immediately before it.
 *
 * A document counts as "sent" in a window when its first DOCUMENT_SENT audit log
 * falls inside that window.
 */
export const getTeamAnalyticsOverview = async ({
  userId,
  userEmail,
  teamId,
  range,
  from,
  to,
  timezone,
}: GetTeamAnalyticsOverviewOptions): Promise<TGetTeamAnalyticsOverviewResponse> => {
  const scope = await getTeamAnalyticsScope({ teamId, userId, userEmail });
  const resolvedRange = resolveTeamAnalyticsRange({ range, from, to, timezone });

  const { start, end, previousStart, previousEnd } = resolvedRange;

  const members = await getTeamAnalyticsMembers(scope.teamId);
  const memberUserIds = members.map((member) => member.id);

  const row = await kyselyPrisma.$kysely
    .with('scopedEnvelopes', (db) =>
      db
        .selectFrom('Envelope')
        .select(['Envelope.id', 'Envelope.status', 'Envelope.userId'])
        .where((eb) => scope.applyEnvelopeScope(eb)),
    )
    .with('firstSent', (db) =>
      db
        .selectFrom('DocumentAuditLog')
        .innerJoin('scopedEnvelopes', 'scopedEnvelopes.id', 'DocumentAuditLog.envelopeId')
        .select(({ fn }) => ['DocumentAuditLog.envelopeId', fn.min('DocumentAuditLog.createdAt').as('sentAt')])
        .where('DocumentAuditLog.type', '=', DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT)
        .where('DocumentAuditLog.createdAt', '>=', previousStart)
        .where('DocumentAuditLog.createdAt', '<', end)
        .groupBy('DocumentAuditLog.envelopeId'),
    )
    .selectFrom('firstSent')
    .innerJoin('scopedEnvelopes', 'scopedEnvelopes.id', 'firstSent.envelopeId')
    .select(({ fn, eb }) => {
      const inCurrentWindow = eb.and([eb('firstSent.sentAt', '>=', start), eb('firstSent.sentAt', '<', end)]);

      const inPreviousWindow = eb.and([
        eb('firstSent.sentAt', '>=', previousStart),
        eb('firstSent.sentAt', '<', previousEnd),
      ]);

      const isCompleted = eb('scopedEnvelopes.status', '=', sql.lit(DocumentStatus.COMPLETED));

      // Only current members count as active, so senders who have since left the team
      // can never push "active" above "total".
      const activeMemberFilter =
        memberUserIds.length > 0
          ? eb.and([inCurrentWindow, eb('scopedEnvelopes.userId', 'in', memberUserIds)])
          : inCurrentWindow;

      return [
        fn.countAll().filterWhere(inCurrentWindow).as('sentCurrent'),
        fn.countAll().filterWhere(inPreviousWindow).as('sentPrevious'),
        fn
          .countAll()
          .filterWhere(eb.and([inCurrentWindow, isCompleted]))
          .as('completedCurrent'),
        fn
          .countAll()
          .filterWhere(eb.and([inPreviousWindow, isCompleted]))
          .as('completedPrevious'),
        fn.count('scopedEnvelopes.userId').distinct().filterWhere(activeMemberFilter).as('activeMembers'),
      ];
    })
    .executeTakeFirst();

  if (!row) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Analytics overview query returned no result',
    });
  }

  const sentCurrent = toTeamAnalyticsCount(row.sentCurrent);
  const sentPrevious = toTeamAnalyticsCount(row.sentPrevious);
  const completedCurrent = toTeamAnalyticsCount(row.completedCurrent);
  const completedPrevious = toTeamAnalyticsCount(row.completedPrevious);

  return {
    range: resolvedRange,
    sent: {
      current: sentCurrent,
      previous: sentPrevious,
    },
    completionRate: {
      completed: completedCurrent,
      sent: sentCurrent,
      rate: calculateTeamAnalyticsCompletionRate({ completed: completedCurrent, sent: sentCurrent }),
      previousRate: calculateTeamAnalyticsCompletionRate({ completed: completedPrevious, sent: sentPrevious }),
    },
    members: {
      total: memberUserIds.length,
      active: memberUserIds.length === 0 ? 0 : toTeamAnalyticsCount(row.activeMembers),
    },
  };
};
