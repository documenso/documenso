import { kyselyPrisma, prisma, sql } from '@documenso/prisma';
import type {
  TGetOrganisationAnalyticsOverviewRequest,
  TGetOrganisationAnalyticsOverviewResponse,
} from '@documenso/trpc/server/organisation-router/get-organisation-analytics.types';
import { DocumentStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import { calculateTeamAnalyticsCompletionRate, toTeamAnalyticsCount } from '../team/get-team-analytics-scope';
import { getOrganisationAnalyticsScope } from './get-organisation-analytics-scope';

export type GetOrganisationAnalyticsOverviewOptions = TGetOrganisationAnalyticsOverviewRequest & {
  userId: number;
};

/**
 * Headline organisation analytics: documents sent, completion rate and team
 * activity for the requested window and the window immediately before it.
 *
 * A document counts as "sent" in a window when its first DOCUMENT_SENT audit log
 * falls inside that window.
 */
export const getOrganisationAnalyticsOverview = async ({
  userId,
  organisationId,
  range,
  from,
  to,
  timezone,
}: GetOrganisationAnalyticsOverviewOptions): Promise<TGetOrganisationAnalyticsOverviewResponse> => {
  const scope = await getOrganisationAnalyticsScope({ organisationId, userId });
  const resolvedRange = resolveTeamAnalyticsRange({ range, from, to, timezone });

  const { start, end, previousStart, previousEnd } = resolvedRange;

  const teamCount = await prisma.team.count({
    where: {
      organisationId: scope.organisationId,
    },
  });

  const row = await kyselyPrisma.$kysely
    .with('scopedEnvelopes', (db) =>
      db
        .selectFrom('Envelope')
        .select(['Envelope.id', 'Envelope.status', 'Envelope.teamId'])
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
        fn.count('scopedEnvelopes.teamId').distinct().filterWhere(inCurrentWindow).as('activeTeams'),
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
    teams: {
      total: teamCount,
      active: toTeamAnalyticsCount(row.activeTeams),
    },
  };
};
