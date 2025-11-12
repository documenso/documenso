import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import type { MonthlyStats } from '@documenso/lib/server-only/analytics';

import { MonthlyActiveUsersChart } from '~/components/general/admin-monthly-active-user-charts';

export type AnalyticsChartsProps = {
  monthlyData?: MonthlyStats;
  showActiveUsers?: boolean;
};

export const AnalyticsCharts = ({ monthlyData, showActiveUsers = false }: AnalyticsChartsProps) => {
  const { _ } = useLingui();

  if (!monthlyData) {
    return null;
  }

  // Ensure all data has cume_count for chart compatibility
  const formatDataForChart = (data: MonthlyStats) => {
    return data.map((item) => ({
      ...item,
      count: item.count,
      cume_count: item.cume_count || 0,
    }));
  };

  return (
    <div className="mt-16">
      <h3 className="text-3xl font-semibold">
        <Trans>Charts</Trans>
      </h3>
      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {showActiveUsers && (
          <>
            <MonthlyActiveUsersChart
              title={_(msg`Active Users (created document)`)}
              data={formatDataForChart(monthlyData)}
            />
            <MonthlyActiveUsersChart
              title={_(msg`Cumulative Active Users`)}
              data={formatDataForChart(monthlyData)}
              cummulative
            />
          </>
        )}

        {!showActiveUsers && (
          <>
            <MonthlyActiveUsersChart
              title={_(msg`Documents Created`)}
              data={formatDataForChart(monthlyData)}
            />
            <MonthlyActiveUsersChart
              title={_(msg`Documents Completed`)}
              data={formatDataForChart(
                monthlyData.map((d) => ({ ...d, count: d.signed_count || 0 })),
              )}
            />
          </>
        )}
      </div>
    </div>
  );
};
