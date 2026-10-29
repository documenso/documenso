import { Trans } from '@lingui/react/macro';
import { CalendarIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';

import { FilterPill } from '~/components/general/filter-pill';
import { DOCUMENTS_PERIOD_VALUES, documentsSearchParams } from '~/utils/documents-search-params';

const PERIOD_OPTIONS = [
  { value: '7d', label: <Trans>Last 7 days</Trans> },
  { value: '14d', label: <Trans>Last 14 days</Trans> },
  { value: '30d', label: <Trans>Last 30 days</Trans> },
];

export const DocumentsTablePeriodFilter = () => {
  const [{ period }, setSearchParams] = useQueryStates(
    {
      period: documentsSearchParams.period,
      page: documentsSearchParams.page,
    },
    { history: 'push', shallow: false },
  );

  const onChange = (newPeriod: string | null) => {
    void setSearchParams({
      period: DOCUMENTS_PERIOD_VALUES.find((value) => value === newPeriod) ?? null,
      page: null,
    });
  };

  return (
    <FilterPill
      icon={CalendarIcon}
      label={<Trans>Period</Trans>}
      value={period}
      onChange={onChange}
      options={PERIOD_OPTIONS}
      testId="documents-table-period-filter"
    />
  );
};
