import { useSearchParams } from 'react-router';

import type { DateFilterPeriod } from '~/components/analytics/analytics-date-filter';

export const useAnalyticsFilter = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const period = (searchParams.get('period') as DateFilterPeriod) || 'all';

  const handlePeriodChange = (newPeriod: DateFilterPeriod) => {
    const params = new URLSearchParams(searchParams);
    if (newPeriod === 'all') {
      params.delete('period');
    } else {
      params.set('period', newPeriod);
    }
    setSearchParams(params);
  };

  return {
    period,
    handlePeriodChange,
  };
};
