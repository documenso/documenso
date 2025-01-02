import { useMemo } from 'react';

import { Trans } from '@lingui/macro';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

import { isPeriodSelectorValue } from './types';

export const PeriodSelector = () => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  const period = useMemo(() => {
    const p = searchParams?.get('period') ?? 'all';

    return isPeriodSelectorValue(p) ? p : 'all';
  }, [searchParams]);

  const onPeriodChange = (newPeriod: string) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('period', newPeriod);

    if (newPeriod === '' || newPeriod === 'all') {
      params.delete('period');
    }

    void navigate(`${pathname}?${params.toString()}`, { preventScrollReset: true });
  };

  return (
    <Select defaultValue={period} onValueChange={onPeriodChange}>
      <SelectTrigger className="text-muted-foreground max-w-[200px]">
        <SelectValue />
      </SelectTrigger>

      <SelectContent position="popper">
        <SelectItem value="all">
          <Trans>All Time</Trans>
        </SelectItem>
        <SelectItem value="7d">
          <Trans>Last 7 days</Trans>
        </SelectItem>
        <SelectItem value="14d">
          <Trans>Last 14 days</Trans>
        </SelectItem>
        <SelectItem value="30d">
          <Trans>Last 30 days</Trans>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
