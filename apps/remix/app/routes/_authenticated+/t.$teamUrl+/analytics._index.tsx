import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { IS_TEAM_ANALYTICS_ENABLED } from '@documenso/lib/constants/app';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { canExecuteTeamAction, formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { ZAnalyticsPeriodSchema } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { Link, redirect, useSearchParams } from 'react-router';
import { z } from 'zod';

import { AnalyticsPeriodSelector } from '~/components/general/analytics-period-selector';
import { CardMetric } from '~/components/general/metric-card';
import { DocumentsTableSenderFilter } from '~/components/tables/documents-table-sender-filter';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/analytics._index';

export function meta() {
  return appMetaTags(msg`Analytics`);
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Behind a rollout flag: silently send everyone back to documents when off.
  if (!IS_TEAM_ANALYTICS_ENABLED()) {
    throw redirect(formatDocumentsPath(params.teamUrl));
  }

  const session = await getSession(request);

  const team = await getTeamByUrl({
    userId: session.user.id,
    teamUrl: params.teamUrl,
  });

  // Admins and managers only. Members are silently redirected (no existence leak).
  if (!team || !canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole)) {
    throw redirect(formatDocumentsPath(params.teamUrl));
  }
}

const ZSearchParamsSchema = z.object({
  period: ZAnalyticsPeriodSchema.optional().catch(undefined),
  senderIds: z.string().transform(parseToIntegerArray).optional().catch([]),
});

export default function TeamAnalyticsPage() {
  const { _ } = useLingui();

  const team = useCurrentTeam();

  const [searchParams] = useSearchParams();

  const { period, senderIds } = useMemo(
    () => ZSearchParamsSchema.parse(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  }, []);

  const { data, isLoading } = trpc.team.getAnalytics.useQuery({
    teamId: team.id,
    period,
    timezone,
    senderIds,
  });

  const analytics = data ?? {
    sent: 0,
    draft: 0,
    pending: 0,
    completed: 0,
    declined: 0,
  };

  const hasActivity =
    analytics.sent > 0 ||
    analytics.draft > 0 ||
    analytics.pending > 0 ||
    analytics.completed > 0 ||
    analytics.declined > 0;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-8">
        <div className="flex flex-row items-center">
          <Avatar className="mr-3 h-12 w-12 border-2 border-white border-solid dark:border-border">
            {team.avatarImageId && <AvatarImage src={formatAvatarUrl(team.avatarImageId)} />}
            <AvatarFallback className="text-muted-foreground text-xs">{team.name.slice(0, 1)}</AvatarFallback>
          </Avatar>

          <h2 className="font-semibold text-4xl">
            <Trans>Analytics</Trans>
          </h2>
        </div>

        <div className="-m-1 flex flex-wrap items-center gap-x-4 gap-y-6 overflow-hidden p-1">
          <DocumentsTableSenderFilter teamId={team.id} />

          <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
            <AnalyticsPeriodSelector />
          </div>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <SpinnerBox className="py-32" />
        ) : hasActivity ? (
          <div data-testid="team-analytics-content">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div data-testid="metric-sent" className="contents">
                <CardMetric title={_(msg`Documents Sent`)} value={analytics.sent} />
              </div>
              <div data-testid="metric-completed-headline" className="contents">
                <CardMetric title={_(msg`Completed`)} value={analytics.completed} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <CardMetric title={_(msg`Draft`)} value={analytics.draft} />
              <CardMetric title={_(msg`Pending`)} value={analytics.pending} />
              <CardMetric title={_(msg`Completed`)} value={analytics.completed} />
              <CardMetric title={_(msg`Declined`)} value={analytics.declined} />
            </div>

            <p className="mt-3 max-w-3xl text-muted-foreground text-xs">
              <Trans>
                Each tile counts documents that entered that state during the selected period, on its own date. They are
                independent activity counts and do not add up to Documents Sent.
              </Trans>
            </p>
          </div>
        ) : (
          <div
            data-testid="team-analytics-empty"
            className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed py-20 text-center"
          >
            <h3 className="font-semibold text-foreground text-lg">
              <Trans>No analytics to show yet</Trans>
            </h3>

            <p className="mt-2 max-w-md text-muted-foreground text-sm">
              <Trans>
                There's no document activity for the selected period. Send your first document to start tracking your
                team's usage here.
              </Trans>
            </p>

            <Button asChild className="mt-6">
              <Link to={formatDocumentsPath(team.url)}>
                <Trans>Send a document</Trans>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
