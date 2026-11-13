import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import {
  getQuotaUsagePercent,
  isQuotaExceeded,
  isQuotaNearing,
  normalizeCapacityLimit,
} from '@documenso/lib/universal/quota-usage';
import { cn } from '@documenso/ui/lib/utils';
import type { BadgeProps } from '@documenso/ui/primitives/badge';
import { Badge } from '@documenso/ui/primitives/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import type { OrganisationClaim, OrganisationMonthlyStat } from '@prisma/client';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { OrganisationUsageResetButton } from './organisation-usage-reset-button';

type OrganisationUsage = {
  monthlyStats: Pick<
    OrganisationMonthlyStat,
    'period' | 'documentCount' | 'emailCount' | 'apiCount' | 'emailReports'
  >[];
  organisationClaim: OrganisationClaim;
  memberCount: number;
  teamCount: number;
};

type OrganisationUsagePanelProps = OrganisationUsage & {
  organisationId: string;
};

/** Every limit as one aligned row: capacity first, then the monthly counters with their resets. */
export const OrganisationUsagePanel = ({ organisationId, ...usage }: OrganisationUsagePanelProps) => {
  const { t } = useLingui();

  const currentPeriod = currentMonthlyPeriod();

  const [period, setPeriod] = useState(currentPeriod);

  // The current month has no stat row until its first counted event, so it is always offered.
  const periods = [...new Set([currentPeriod, ...usage.monthlyStats.map((stat) => stat.period)])];

  const meters = getUsageMeters(usage, period);
  const reports = usage.monthlyStats.find((stat) => stat.period === period)?.emailReports ?? 0;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-semibold text-base">
          <Trans>Capacity</Trans>
        </h3>
        <p className="mt-1 text-muted-foreground text-sm">
          <Trans>Counted now. These do not reset.</Trans>
        </p>

        <ul className="mt-3 divide-y rounded-lg border">
          {meters.map((meter) => !meter.counter && <UsageMeterRow key={meter.key} meter={meter} />)}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base">
              <Trans>Monthly usage</Trans>
            </h3>
            <p className="mt-1 text-muted-foreground text-sm">
              {period === currentPeriod ? (
                <Trans>Counters reset on the first of each month, UTC.</Trans>
              ) : (
                <Trans>A past month, read against the limits of today.</Trans>
              )}
            </p>
          </div>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-36 tabular-nums" aria-label={t`Month`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((option) => (
                <SelectItem key={option} value={option} className="tabular-nums">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ul className="mt-3 divide-y rounded-lg border">
          {meters.map(
            (meter) =>
              meter.counter && (
                <UsageMeterRow
                  key={meter.key}
                  meter={meter}
                  action={
                    // Resetting only affects the current month, because the server hardcodes the current period.
                    period === currentPeriod && (
                      <OrganisationUsageResetButton organisationId={organisationId} counter={meter.counter} />
                    )
                  }
                />
              ),
          )}

          <li className="flex h-14 items-center gap-4 px-4 text-sm">
            <span className="flex-1 font-medium">
              <Trans>Reports sent</Trans>
            </span>
            <span className="w-28 shrink-0 text-right tabular-nums">{reports.toLocaleString()}</span>
            {/* The width of a badge slot, a gap and an action slot, so the figure sits in the count column. */}
            <span className="w-[216px] shrink-0" />
          </li>
        </ul>
      </section>
    </div>
  );
};

/** A coloured dot for the worst limit, or nothing when every limit has room. */
export const OrganisationUsageAlertDot = (usage: OrganisationUsage) => {
  const { t } = useLingui();

  const [worst] = getUsageMeters(usage, currentMonthlyPeriod())
    .filter((meter) => SEVERITY.includes(meter.state))
    .sort((a, b) => SEVERITY.indexOf(a.state) - SEVERITY.indexOf(b.state));

  if (!worst) {
    return null;
  }

  return (
    <>
      <span aria-hidden="true" className={cn('ml-2 h-2 w-2 shrink-0 rounded-full', USAGE_STATES[worst.state].bar)} />
      <span className="sr-only">
        {t(worst.label)}: {t(USAGE_STATES[worst.state].label)}
      </span>
    </>
  );
};

/** The trailing slot is reserved even when empty, so bars and figures line up down the list. */
const UsageMeterRow = ({ meter, action }: { meter: UsageMeter; action?: ReactNode }) => {
  const { t } = useLingui();

  const state = USAGE_STATES[meter.state];

  return (
    <li className="flex min-h-14 items-center gap-4 px-4 py-2 text-sm">
      <span className="w-28 shrink-0 font-medium">{t(meter.label)}</span>

      {meter.limit === null ? (
        <span className="min-w-12 flex-1" />
      ) : (
        <div
          role="progressbar"
          aria-label={t(meter.label)}
          aria-valuemin={0}
          aria-valuemax={meter.limit}
          aria-valuenow={meter.used}
          className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className={cn('h-full rounded-full', state.bar)}
            style={{ width: `${meter.state === 'blocked' ? 100 : getQuotaUsagePercent(meter.used, meter.limit)}%` }}
          />
        </div>
      )}

      <span className="w-28 shrink-0 text-right tabular-nums">
        {meter.used.toLocaleString()}
        {meter.limit !== null && <span className="text-muted-foreground"> / {meter.limit.toLocaleString()}</span>}
      </span>

      <span className="flex w-28 shrink-0">
        <Badge variant={state.badge} size="small">
          {t(state.label)}
        </Badge>
      </span>

      <span className="flex w-[88px] shrink-0 justify-end">{action}</span>
    </li>
  );
};

/** Usage against every limit of the claim. Monthly limits read the given `YYYY-MM` period. */
const getUsageMeters = (usage: OrganisationUsage, period: string): UsageMeter[] => {
  const claim = usage.organisationClaim;
  const stat = usage.monthlyStats.find((monthlyStat) => monthlyStat.period === period);

  const meter = (values: Omit<UsageMeter, 'state'>): UsageMeter => ({
    ...values,
    state: getUsageState(values.used, values.limit),
  });

  return [
    meter({
      key: 'members',
      label: msg`Members`,
      used: usage.memberCount,
      limit: normalizeCapacityLimit(claim.memberCount),
    }),
    meter({
      key: 'teams',
      label: msg`Teams`,
      used: usage.teamCount,
      limit: normalizeCapacityLimit(claim.teamCount),
    }),
    meter({
      key: 'documents',
      label: msg`Documents`,
      counter: 'document',
      used: stat?.documentCount ?? 0,
      limit: claim.documentQuota,
    }),
    meter({
      key: 'emails',
      label: msg`Emails`,
      counter: 'email',
      used: stat?.emailCount ?? 0,
      limit: claim.emailQuota,
    }),
    meter({
      key: 'api',
      label: msg`API requests`,
      counter: 'api',
      used: stat?.apiCount ?? 0,
      limit: claim.apiQuota,
    }),
  ];
};

const getUsageState = (used: number, limit: number | null): UsageState => {
  if (limit === null) {
    return 'unlimited';
  }

  if (limit === 0) {
    return 'blocked';
  }

  if (used > limit) {
    return 'exceeded';
  }

  if (isQuotaExceeded(limit, used)) {
    return 'reached';
  }

  return isQuotaNearing(limit, used) ? 'near' : 'within';
};

const USAGE_STATES: Record<
  UsageState,
  { label: MessageDescriptor; badge: NonNullable<BadgeProps['variant']>; bar: string }
> = {
  unlimited: { label: msg`Unlimited`, badge: 'neutral', bar: 'bg-muted-foreground/40' },
  blocked: { label: msg`Blocked`, badge: 'destructive', bar: 'bg-destructive' },
  exceeded: { label: msg`Exceeded`, badge: 'destructive', bar: 'bg-destructive' },
  reached: { label: msg`Limit reached`, badge: 'orange', bar: 'bg-orange-500 dark:bg-orange-400' },
  near: { label: msg`Near limit`, badge: 'warning', bar: 'bg-yellow-500 dark:bg-yellow-400' },
  within: { label: msg`Within limit`, badge: 'default', bar: 'bg-primary' },
};

/** The states that need an admin's attention, worst first. */
const SEVERITY: UsageState[] = ['blocked', 'exceeded', 'reached', 'near'];

type UsageState = 'unlimited' | 'blocked' | 'exceeded' | 'reached' | 'near' | 'within';

type UsageMeter = {
  key: string;
  label: MessageDescriptor;
  /** The monthly counter behind the meter. Capacity meters have none: they count what exists now. */
  counter?: 'document' | 'email' | 'api';
  used: number;
  limit: number | null;
  state: UsageState;
};
