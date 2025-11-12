import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getUserDocumentStats, getUserRecipientsStats } from '@documenso/lib/server-only/analytics';

import {
  type DateFilterPeriod,
  getDateRangeFromPeriod,
} from '~/components/analytics/analytics-date-filter';
import { AnalyticsPage } from '~/components/analytics/analytics-page';
import { useAnalyticsFilter } from '~/hooks/use-analytics-filter';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/analytics';

export function meta() {
  return appMetaTags('Personal Analytics');
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const url = new URL(request.url);
  const period = (url.searchParams.get('period') as DateFilterPeriod) || 'all';

  const { dateFrom, dateTo } = getDateRangeFromPeriod(period);

  const [docStats, recipientStats] = await Promise.all([
    getUserDocumentStats({ userId: session.user.id, dateFrom, dateTo }),
    getUserRecipientsStats({ userId: session.user.id, dateFrom, dateTo }),
  ]);

  return {
    docStats,
    recipientStats,
    period,
  };
}

export default function PersonalAnalyticsPage({ loaderData }: Route.ComponentProps) {
  const { handlePeriodChange } = useAnalyticsFilter();
  const { docStats, recipientStats, period } = loaderData;

  return (
    <AnalyticsPage
      title="Personal Analytics"
      subtitle="Your personal document signing analytics and insights"
      data={{
        docStats,
        recipientStats,
        period,
      }}
      showCharts={false}
      onPeriodChange={handlePeriodChange}
      containerClassName=""
    />
  );
}
