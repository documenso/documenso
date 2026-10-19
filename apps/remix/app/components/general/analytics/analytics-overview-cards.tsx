import type { TGetTeamAnalyticsOverviewResponse } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { cn } from '@documenso/ui/lib/utils';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRightIcon, ArrowUpRightIcon, CircleCheckIcon, SendIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { AnalyticsQueryResult } from '~/utils/analytics';

import { AnalyticsStatCard } from './analytics-stat-card';

/** The part of the overview response shared by the team and organisation procedures. */
export type AnalyticsOverviewData = Pick<TGetTeamAnalyticsOverviewResponse, 'sent' | 'completionRate'>;

/**
 * The third card counts the scope's "entities" (team members, organisation teams)
 * and how many of them were active in the period.
 */
export type AnalyticsOverviewEntityCard<TData> = {
  icon: LucideIcon;
  title: ReactNode;
  /** Applied to the value element, e.g. `analytics-members`. */
  testId: string;
  select: (data: TData) => { active: number; total: number };
};

export type AnalyticsOverviewCardsProps<TData extends AnalyticsOverviewData> = {
  query: AnalyticsQueryResult<TData>;
  entity: AnalyticsOverviewEntityCard<TData>;
};

export const AnalyticsOverviewCards = <TData extends AnalyticsOverviewData>({
  query,
  entity,
}: AnalyticsOverviewCardsProps<TData>) => {
  const { i18n } = useLingui();

  const { data, isLoading, isError, refetch } = query;

  const entityCounts = data ? entity.select(data) : null;

  const formatNumber = (value: number) => value.toLocaleString(i18n.locale);

  const sharedProps = {
    isLoading: isLoading || !data,
    isError,
    onRetry: refetch,
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <AnalyticsStatCard
        {...sharedProps}
        icon={SendIcon}
        title={<Trans>Documents sent</Trans>}
        value={data ? formatNumber(data.sent.current) : null}
        badge={data ? <SentDeltaBadge current={data.sent.current} previous={data.sent.previous} /> : null}
        description={<Trans>vs. previous period</Trans>}
        testId="analytics-sent"
      />

      <AnalyticsStatCard
        {...sharedProps}
        icon={CircleCheckIcon}
        title={<Trans>Completion rate</Trans>}
        value={data ? formatRate(data.completionRate.rate) : null}
        badge={
          data ? (
            <CompletionRateDeltaBadge rate={data.completionRate.rate} previousRate={data.completionRate.previousRate} />
          ) : null
        }
        description={<Trans>of sent documents completed</Trans>}
        testId="analytics-completion-rate"
      />

      <AnalyticsStatCard
        {...sharedProps}
        icon={entity.icon}
        title={entity.title}
        value={entityCounts ? `${formatNumber(entityCounts.active)}/${formatNumber(entityCounts.total)}` : null}
        description={
          entityCounts ? (
            <Trans>
              {formatNumber(entityCounts.active)} active · {formatNumber(entityCounts.total - entityCounts.active)}{' '}
              inactive
            </Trans>
          ) : null
        }
        testId={entity.testId}
      />
    </div>
  );
};

type SentDeltaBadgeProps = {
  current: number;
  previous: number;
};

const SentDeltaBadge = ({ current, previous }: SentDeltaBadgeProps) => {
  if (previous === 0 && current === 0) {
    return null;
  }

  if (previous === 0) {
    return (
      <DeltaBadge tone="new" testId="analytics-sent-delta">
        <Trans>New</Trans>
      </DeltaBadge>
    );
  }

  const delta = Math.round(((current - previous) / previous) * 100);

  // Percentages off a tiny base (e.g. 1 → 165) are noise; cap the display.
  const label =
    delta > MAX_DISPLAYED_DELTA_PERCENT ? `>${MAX_DISPLAYED_DELTA_PERCENT}%` : `${formatSignedNumber(delta)}%`;

  return (
    <DeltaBadge tone={getDeltaTone(delta)} testId="analytics-sent-delta">
      {label}
    </DeltaBadge>
  );
};

type CompletionRateDeltaBadgeProps = {
  rate: number | null;
  previousRate: number | null;
};

const CompletionRateDeltaBadge = ({ rate, previousRate }: CompletionRateDeltaBadgeProps) => {
  if (rate === null || previousRate === null) {
    return null;
  }

  // Compare the rounded values so the delta always agrees with the displayed rate.
  const delta = Math.round(rate) - Math.round(previousRate);

  return (
    <DeltaBadge tone={getDeltaTone(delta)} testId="analytics-completion-rate-delta">
      {formatSignedNumber(delta)}%
    </DeltaBadge>
  );
};

type DeltaTone = 'positive' | 'negative' | 'zero' | 'new';

type DeltaBadgeProps = {
  tone: DeltaTone;
  testId: string;
  children: ReactNode;
};

const DeltaBadge = ({ tone, testId, children }: DeltaBadgeProps) => {
  const DeltaIcon = DELTA_TONE_ICONS[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-x-0.5 rounded-full px-1.5 py-0.5 font-medium text-xs tabular-nums leading-none',
        DELTA_TONE_CLASSES[tone],
      )}
      data-testid={testId}
    >
      {DeltaIcon && <DeltaIcon className="-ml-0.5 h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
};

const DELTA_TONE_CLASSES: Record<DeltaTone, string> = {
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  negative: 'bg-red-500/10 text-red-600 dark:text-red-400',
  zero: 'bg-muted text-muted-foreground',
  new: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const MAX_DISPLAYED_DELTA_PERCENT = 999;

const DELTA_TONE_ICONS: Record<DeltaTone, typeof ArrowUpRightIcon | null> = {
  positive: ArrowUpRightIcon,
  negative: ArrowDownRightIcon,
  zero: null,
  new: null,
};

const formatRate = (rate: number | null) => {
  if (rate === null) {
    return '—';
  }

  return `${Math.round(rate)}%`;
};

const formatSignedNumber = (value: number) => {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
};

const getDeltaTone = (delta: number): DeltaTone => {
  if (delta > 0) {
    return 'positive';
  }

  if (delta < 0) {
    return 'negative';
  }

  return 'zero';
};
