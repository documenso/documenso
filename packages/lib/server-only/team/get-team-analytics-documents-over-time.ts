import { kyselyPrisma, sql } from '@documenso/prisma';
import type {
  TGetTeamAnalyticsDocumentsOverTimeRequest,
  TGetTeamAnalyticsDocumentsOverTimeResponse,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { DateTime } from 'luxon';

import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import { getTeamAnalyticsScope, toTeamAnalyticsCount } from './get-team-analytics-scope';

export type GetTeamAnalyticsDocumentsOverTimeOptions = TGetTeamAnalyticsDocumentsOverTimeRequest & {
  userId: number;
  userEmail: string;
};

/**
 * Number of visible documents created per day (or per month for `12m` and long custom
 * ranges) inside the requested window, zero-filled so every bucket is present. With
 * month buckets the first and last points may cover only part of a month.
 */
export const getTeamAnalyticsDocumentsOverTime = async ({
  userId,
  userEmail,
  teamId,
  range,
  from,
  to,
  timezone,
}: GetTeamAnalyticsDocumentsOverTimeOptions): Promise<TGetTeamAnalyticsDocumentsOverTimeResponse> => {
  const scope = await getTeamAnalyticsScope({ teamId, userId, userEmail });
  const resolvedRange = resolveTeamAnalyticsRange({ range, from, to, timezone });

  const { start, end, bucket } = resolvedRange;

  // `createdAt` is a naive TIMESTAMP holding UTC, so it must be tagged as UTC before
  // shifting into the request timezone; otherwise Postgres treats it as local time.
  const bucketDate = sql<string>`to_char(
    date_trunc(${bucket}, (${sql.ref('Envelope.createdAt')} at time zone 'UTC') at time zone ${timezone}),
    'YYYY-MM-DD'
  )`;

  const rows = await kyselyPrisma.$kysely
    .selectFrom('Envelope')
    .select(({ fn }) => [bucketDate.as('date'), fn.countAll().as('count')])
    .where((eb) => scope.applyEnvelopeScope(eb))
    .where('Envelope.createdAt', '>=', start)
    .where('Envelope.createdAt', '<', end)
    .groupBy('date')
    .orderBy('date')
    .execute();

  const countsByDate = new Map(rows.map((row) => [row.date, toTeamAnalyticsCount(row.count)]));

  const points: TGetTeamAnalyticsDocumentsOverTimeResponse['points'] = [];

  const endTime = DateTime.fromJSDate(end, { zone: timezone });

  // Align the cursor to the bucket boundary so it produces the same keys as
  // `date_trunc` above. A custom range starting mid-month with month buckets would
  // otherwise miss its first (partial) month entirely.
  let cursor = DateTime.fromJSDate(start, { zone: timezone }).startOf(bucket);

  while (cursor < endTime) {
    const date = cursor.toFormat('yyyy-MM-dd');

    points.push({
      date,
      count: countsByDate.get(date) ?? 0,
    });

    cursor = cursor.plus(bucket === 'month' ? { months: 1 } : { days: 1 });
  }

  const total = points.reduce((sum, point) => sum + point.count, 0);

  return {
    range: resolvedRange,
    total,
    points,
  };
};
