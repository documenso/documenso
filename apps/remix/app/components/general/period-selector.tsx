import { useMemo } from 'react';

import { Trans } from '@lingui/react/macro';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import type { PeriodSelectorValue } from '@documenso/lib/server-only/document/find-documents';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

const isPeriodSelectorValue = (value: unknown): value is PeriodSelectorValue => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ['', '7d', '14d', '30d'].includes(value as string);
};

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
