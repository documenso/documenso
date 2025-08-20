import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  getTeamDocumentStats,
  getTeamMonthlyActiveUsers,
  getTeamRecipientsStats,
} from '@documenso/lib/server-only/analytics';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';

import {
  type DateFilterPeriod,
  getDateRangeFromPeriod,
} from '~/components/analytics/analytics-date-filter';
import { AnalyticsPage } from '~/components/analytics/analytics-page';
import { useAnalyticsFilter } from '~/hooks/use-analytics-filter';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/analytics';

export function meta() {
  return appMetaTags('Team Analytics');
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const session = await getSession(request);
    const url = new URL(request.url);
    const period = (url.searchParams.get('period') as DateFilterPeriod) || 'all';

    const team = await getTeamByUrl({
      userId: session.user.id,
      teamUrl: params.teamUrl,
    });

    if (!team || !canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole)) {
      throw redirect(`/t/${params.teamUrl}`);
    }

    const { dateFrom, dateTo } = getDateRangeFromPeriod(period);

    const [docStats, recipientStats, monthlyActiveUsers] = await Promise.all([
      getTeamDocumentStats({ teamId: team.id, dateFrom, dateTo }),
      getTeamRecipientsStats({ teamId: team.id, dateFrom, dateTo }),
      getTeamMonthlyActiveUsers(team.id),
    ]);

    return {
      docStats,
      recipientStats,
      monthlyActiveUsers,
      period,
    };
  } catch (error) {
    console.error('Failed to load team analytics:', error);

    // If it's a redirect, re-throw it
    if (error instanceof Response) {
      throw error;
    }

    throw new Response('Failed to load team analytics data', { status: 500 });
  }
}

export default function TeamAnalyticsPage({ loaderData }: Route.ComponentProps) {
  const team = useCurrentTeam();
  const { handlePeriodChange } = useAnalyticsFilter();

  const { docStats, recipientStats, monthlyActiveUsers, period } = loaderData;

  return (
    <AnalyticsPage
      title="Team Analytics"
      subtitle={`Analytics and insights for ${team.name}`}
      data={{
        docStats,
        recipientStats,
        monthlyData: monthlyActiveUsers,
        period,
      }}
      showCharts={true}
      onPeriodChange={handlePeriodChange}
    />
  );
}
