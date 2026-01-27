import { useTransition } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { DateRange } from '@documenso/lib/types/search-params';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

type DateRangeFilterProps = {
  currentRange: DateRange;
};

export const DateRangeFilter = ({ currentRange }: DateRangeFilterProps) => {
  const { _ } = useLingui();
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();

  const handleRangeChange = (value: string) => {
    startTransition(() => {
      updateSearchParams({
        dateRange: value as DateRange,
        page: 1,
      });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={currentRange} onValueChange={handleRangeChange} disabled={isPending}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last30days">{_(msg`Last 30 Days`)}</SelectItem>
          <SelectItem value="last90days">{_(msg`Last 90 Days`)}</SelectItem>
          <SelectItem value="lastYear">{_(msg`Last Year`)}</SelectItem>
          <SelectItem value="allTime">{_(msg`All Time`)}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
