import { ZAnalyticsPeriodSchema } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

const DEFAULT_PERIOD = 'month';

const PERIOD_OPTIONS = [
  { value: 'week', label: msg`This week` },
  { value: 'month', label: msg`This month` },
  { value: 'quarter', label: msg`This quarter` },
  { value: 'year', label: msg`This year` },
  { value: 'lastMonth', label: msg`Last month` },
  { value: 'last7Days', label: msg`Last 7 days` },
  { value: 'last30Days', label: msg`Last 30 days` },
] as const;

export const AnalyticsPeriodSelector = () => {
  const { _ } = useLingui();

  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  const period = useMemo(() => {
    const parsed = ZAnalyticsPeriodSchema.safeParse(searchParams?.get('period') ?? DEFAULT_PERIOD);

    return parsed.success ? parsed.data : DEFAULT_PERIOD;
  }, [searchParams]);

  const onPeriodChange = (newPeriod: string) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('period', newPeriod);

    if (newPeriod === DEFAULT_PERIOD) {
      params.delete('period');
    }

    void navigate(`${pathname}?${params.toString()}`, { preventScrollReset: true });
  };

  return (
    <Select value={period} onValueChange={onPeriodChange}>
      <SelectTrigger className="max-w-[200px] text-muted-foreground">
        <SelectValue />
      </SelectTrigger>

      <SelectContent position="popper">
        {PERIOD_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {_(option.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
