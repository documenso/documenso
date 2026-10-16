import { kyselyPrisma, sql } from '@documenso/prisma';
import type {
  TGetTeamAnalyticsMemberActivityRequest,
  TGetTeamAnalyticsMemberActivityResponse,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { DocumentStatus } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import {
  calculateTeamAnalyticsCompletionRate,
  getTeamAnalyticsMembers,
  getTeamAnalyticsScope,
  toTeamAnalyticsCount,
} from './get-team-analytics-scope';

export type GetTeamAnalyticsMemberActivityOptions = TGetTeamAnalyticsMemberActivityRequest & {
  userId: number;
  userEmail: string;
};

/**
 * Per-member activity for every current team member, scoped to documents the
 * caller can see. Members with no visible activity are included with zeros.
 *
 * A document counts as "sent" by a member when the member owns the envelope and
 * it has a DOCUMENT_SENT audit log inside the window. The app logs DOCUMENT_SENT
 * once per document, so the earliest log within the window is used as its sent
 * time (and drives "last active").
 */
export const getTeamAnalyticsMemberActivity = async ({
  userId,
  userEmail,
  teamId,
  range,
  from,
  to,
  timezone,
}: GetTeamAnalyticsMemberActivityOptions): Promise<TGetTeamAnalyticsMemberActivityResponse> => {
  const scope = await getTeamAnalyticsScope({ teamId, userId, userEmail });
  const resolvedRange = resolveTeamAnalyticsRange({ range, from, to, timezone });

  const { start, end } = resolvedRange;

  const members = await getTeamAnalyticsMembers(scope.teamId);

  if (members.length === 0) {
    return {
      range: resolvedRange,
      members: [],
    };
  }

  const memberUserIds = members.map((member) => member.id);

  const rows = await kyselyPrisma.$kysely
    .with('scopedEnvelopes', (db) =>
      db
        .selectFrom('Envelope')
        .select(['Envelope.id', 'Envelope.status', 'Envelope.userId'])
        .where((eb) => scope.applyEnvelopeScope(eb))
        .where('Envelope.userId', 'in', memberUserIds),
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
      'scopedEnvelopes.userId',
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
    .groupBy('scopedEnvelopes.userId')
    .execute();

  const activityByUserId = new Map(rows.map((row) => [row.userId, row]));

  const memberActivity = members.map((member) => {
    const activity = activityByUserId.get(member.id);

    const sent = activity ? toTeamAnalyticsCount(activity.sent) : 0;
    const completed = activity ? toTeamAnalyticsCount(activity.completed) : 0;
    const pending = activity ? toTeamAnalyticsCount(activity.pending) : 0;

    return {
      userId: member.id,
      name: member.name,
      email: member.email,
      avatarImageId: member.avatarImageId,
      sent,
      completed,
      pending,
      completionRate: calculateTeamAnalyticsCompletionRate({ completed, sent }),
      lastActiveAt: activity?.lastActiveAt ?? null,
    };
  });

  memberActivity.sort((a, b) => {
    if (a.sent !== b.sent) {
      return b.sent - a.sent;
    }

    return (a.name || a.email).localeCompare(b.name || b.email, undefined, { sensitivity: 'base' });
  });

  return {
    range: resolvedRange,
    members: memberActivity,
  };
};
