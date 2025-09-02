import { Trans } from '@lingui/react/macro';
import { useNavigation } from 'react-router';

import type {
  DocumentStats,
  MonthlyStats,
  RecipientStats,
} from '@documenso/lib/server-only/analytics';

import { AnalyticsCharts } from './analytics-charts';
import { AnalyticsDateFilter, type DateFilterPeriod } from './analytics-date-filter';
import { AnalyticsMetrics } from './analytics-metrics';

export type AnalyticsPageData = {
  docStats: DocumentStats;
  recipientStats: RecipientStats;
  monthlyData?: MonthlyStats;
  period: DateFilterPeriod;
};

export type AnalyticsPageProps = {
  title: string;
  subtitle: string;
  data: AnalyticsPageData;
  showCharts?: boolean;
  onPeriodChange: (period: DateFilterPeriod) => void;
  containerClassName?: string;
};

export const AnalyticsPage = ({
  title,
  subtitle,
  data,
  showCharts = true,
  onPeriodChange,
  containerClassName = 'mx-auto w-full max-w-screen-xl px-4 md:px-8',
}: AnalyticsPageProps) => {
  const navigation = useNavigation();
  const { docStats, recipientStats, monthlyData, period } = data;
  const isLoading = navigation.state === 'loading';

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold">
            <Trans>{title}</Trans>
          </h2>
          <p className="text-muted-foreground mt-2">
            <Trans>{subtitle}</Trans>
          </p>
        </div>
        <AnalyticsDateFilter value={period} onChange={onPeriodChange} />
      </div>

      <AnalyticsMetrics
        docStats={docStats}
        recipientStats={recipientStats}
        isLoading={isLoading}
        className="mt-8"
      />

      {showCharts && (
        <AnalyticsCharts
          monthlyData={monthlyData}
          showActiveUsers={!!monthlyData?.[0]?.cume_count}
        />
      )}
    </div>
  );
};
