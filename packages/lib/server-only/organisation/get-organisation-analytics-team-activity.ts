import { kyselyPrisma, sql } from '@documenso/prisma';
import type {
  TGetOrganisationAnalyticsTeamActivityRequest,
  TGetOrganisationAnalyticsTeamActivityResponse,
} from '@documenso/trpc/server/organisation-router/get-organisation-analytics.types';
import { DocumentStatus } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import { calculateTeamAnalyticsCompletionRate, toTeamAnalyticsCount } from '../team/get-team-analytics-scope';
import { getOrganisationAnalyticsScope, getOrganisationAnalyticsTeams } from './get-organisation-analytics-scope';

export type GetOrganisationAnalyticsTeamActivityOptions = TGetOrganisationAnalyticsTeamActivityRequest & {
  userId: number;
};

/**
 * Per-team activity for every team in the organisation. Teams with no activity
 * are included with zeros.
 *
 * A document counts as "sent" by a team when it belongs to the team and has a
 * DOCUMENT_SENT audit log inside the window. The app logs DOCUMENT_SENT once per
 * document, so the earliest log within the window is used as its sent time (and
 * drives "last active").
 */
export const getOrganisationAnalyticsTeamActivity = async ({
  userId,
  organisationId,
  range,
  from,
  to,
  timezone,
}: GetOrganisationAnalyticsTeamActivityOptions): Promise<TGetOrganisationAnalyticsTeamActivityResponse> => {
  const scope = await getOrganisationAnalyticsScope({ organisationId, userId });
  const resolvedRange = resolveTeamAnalyticsRange({ range, from, to, timezone });

  const { start, end } = resolvedRange;

  const teams = await getOrganisationAnalyticsTeams(scope.organisationId);

  if (teams.length === 0) {
    return {
      range: resolvedRange,
      teams: [],
    };
  }

  const rows = await kyselyPrisma.$kysely
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
        .where('DocumentAuditLog.createdAt', '>=', start)
        .where('DocumentAuditLog.createdAt', '<', end)
        .groupBy('DocumentAuditLog.envelopeId'),
    )
    .selectFrom('firstSent')
    .innerJoin('scopedEnvelopes', 'scopedEnvelopes.id', 'firstSent.envelopeId')
    .select(({ fn, eb }) => [
      'scopedEnvelopes.teamId',
      fn.countAll().as('sent'),
      fn
        .countAll()
        .filterWhere(eb('scopedEnvelopes.status', '=', sql.lit(DocumentStatus.COMPLETED)))
        .as('completed'),
      fn
        .countAll()
        .filterWhere(eb('scopedEnvelopes.status', '=', sql.lit(DocumentStatus.PENDING)))
        .as('pending'),
      fn.max('firstSent.sentAt').as('lastActiveAt'),
    ])
    .groupBy('scopedEnvelopes.teamId')
    .execute();

  const activityByTeamId = new Map(rows.map((row) => [row.teamId, row]));

  const teamActivity = teams.map((team) => {
    const activity = activityByTeamId.get(team.id);

    const sent = activity ? toTeamAnalyticsCount(activity.sent) : 0;
    const completed = activity ? toTeamAnalyticsCount(activity.completed) : 0;
    const pending = activity ? toTeamAnalyticsCount(activity.pending) : 0;

    return {
      id: team.id,
      name: team.name,
      url: team.url,
      avatarImageId: team.avatarImageId,
      sent,
      completed,
      pending,
      completionRate: calculateTeamAnalyticsCompletionRate({ completed, sent }),
      lastActiveAt: activity?.lastActiveAt ?? null,
    };
  });

  teamActivity.sort((a, b) => {
    if (a.sent !== b.sent) {
      return b.sent - a.sent;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return {
    range: resolvedRange,
    teams: teamActivity,
  };
};
