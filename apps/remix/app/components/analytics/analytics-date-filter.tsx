import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

export type DateFilterPeriod = 'all' | 'year' | 'month' | 'week' | 'day';

export type AnalyticsDateFilterProps = {
  value: DateFilterPeriod;
  onChange: (value: DateFilterPeriod) => void;
  className?: string;
};

export const AnalyticsDateFilter = ({ value, onChange, className }: AnalyticsDateFilterProps) => {
  const { _ } = useLingui();

  const options = useMemo(
    () => [
      { value: 'all' as const, label: _(msg`All Time`) },
      { value: 'year' as const, label: _(msg`This Year`) },
      { value: 'month' as const, label: _(msg`This Month`) },
      { value: 'week' as const, label: _(msg`This Week`) },
      { value: 'day' as const, label: _(msg`Today`) },
    ],
    [_],
  );

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={_(msg`Select period`)}>{selectedOption?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const getDateRangeFromPeriod = (period: DateFilterPeriod) => {
  const now = DateTime.now();

  switch (period) {
    case 'day':
      return {
        dateFrom: now.startOf('day').toJSDate(),
        dateTo: now.endOf('day').toJSDate(),
      };
    case 'week':
      return {
        dateFrom: now.startOf('week').toJSDate(),
        dateTo: now.endOf('week').toJSDate(),
      };
    case 'month':
      return {
        dateFrom: now.startOf('month').toJSDate(),
        dateTo: now.endOf('month').toJSDate(),
      };
    case 'year':
      return {
        dateFrom: now.startOf('year').toJSDate(),
        dateTo: now.endOf('year').toJSDate(),
      };
    case 'all':
    default:
      return {
        dateFrom: undefined,
        dateTo: undefined,
      };
  }
};
