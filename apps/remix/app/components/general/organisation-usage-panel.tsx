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
import { Progress } from '@documenso/ui/primitives/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';

import { Trans } from '@lingui/react/macro';
import type { OrganisationClaim, OrganisationMonthlyStat } from '@prisma/client';
import type { LucideIcon } from 'lucide-react';
import { FileIcon, MailIcon, MailOpenIcon, PlugIcon, UsersIcon, UsersRoundIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { OrganisationUsageResetButton } from './organisation-usage-reset-button';

type CapacityUsage = {
  members: number;
  teams: number;
};

type UsageRow = {
  counter: 'document' | 'email' | 'api';
  label: ReactNode;
  icon: LucideIcon;
  used: number;
  effectiveLimit: number | null;
};

type OrganisationUsagePanelProps = {
  organisationId: string;
  monthlyStats: Pick<
    OrganisationMonthlyStat,
    'period' | 'documentCount' | 'emailCount' | 'apiCount' | 'emailReports'
  >[];
  organisationClaim: OrganisationClaim;
  capacityUsage?: CapacityUsage;
};

type UsageCardState = {
  status: {
    label: ReactNode;
    variant: NonNullable<BadgeProps['variant']>;
  };
  percent: number;
  hasFiniteLimit: boolean;
  progressClassName: string;
  subtext: ReactNode;
};

type UsageCardStateOptions = {
  used: number;
  limit: number | null | undefined;
  footnote?: ReactNode;
};

const getUsageCardState = ({ used, limit, footnote }: UsageCardStateOptions): UsageCardState => {
  const percent = getQuotaUsagePercent(used, limit ?? null);
  const hasFiniteLimit = Boolean(limit && limit > 0);

  if (limit === null || limit === undefined) {
    return {
      status: { label: <Trans>Unlimited</Trans>, variant: 'neutral' },
      percent,
      hasFiniteLimit,
      progressClassName: '',
      subtext: footnote ?? null,
    };
  }

  if (limit === 0) {
    return {
      status: { label: <Trans>Blocked</Trans>, variant: 'destructive' },
      percent,
      hasFiniteLimit,
      progressClassName: '',
      subtext: footnote ?? <Trans>Resource blocked</Trans>,
    };
  }

  if (used > limit) {
    return {
      status: { label: <Trans>Exceeded</Trans>, variant: 'destructive' },
      percent,
      hasFiniteLimit,
      progressClassName: '[&>div]:bg-destructive',
      subtext: footnote ?? null,
    };
  }

  if (isQuotaExceeded(limit, used)) {
    return {
      status: { label: <Trans>Limit reached</Trans>, variant: 'orange' },
      percent,
      hasFiniteLimit,
      progressClassName: '[&>div]:bg-orange-500 dark:[&>div]:bg-orange-400',
      subtext: footnote ?? null,
    };
  }

  if (isQuotaNearing(limit, used)) {
    return {
      status: { label: <Trans>Near limit</Trans>, variant: 'warning' },
      percent,
      hasFiniteLimit,
      progressClassName: '[&>div]:bg-yellow-500 dark:[&>div]:bg-yellow-400',
      subtext: footnote ?? null,
    };
  }

  return {
    status: { label: <Trans>Within limit</Trans>, variant: 'default' },
    percent,
    hasFiniteLimit,
    progressClassName: '',
    subtext: footnote ?? null,
  };
};

type UsageStatCardProps = {
  label: ReactNode;
  icon: LucideIcon;
  used: number;
  limit: number | null | undefined;
  /** When true the card is a plain counter with no limit, status or progress. */
  countOnly?: boolean;
  footnote?: ReactNode;
  action?: ReactNode;
};

const UsageStatCard = ({ label, icon: Icon, used, limit, countOnly = false, footnote, action }: UsageStatCardProps) => {
  const { status, percent, hasFiniteLimit, progressClassName, subtext } = getUsageCardState({ used, limit, footnote });

  return (
    <div className="flex flex-col rounded-lg border bg-background p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium text-foreground text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>

        {!countOnly && (
          <Badge variant={status.variant} size="small">
            {status.label}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-3xl text-foreground tabular-nums tracking-tight">
              {used.toLocaleString()}
            </span>
            {hasFiniteLimit ? (
              <span className="text-base text-muted-foreground tabular-nums">/ {limit?.toLocaleString()}</span>
            ) : null}
          </div>

          {hasFiniteLimit ? (
            <span className="font-medium text-muted-foreground text-sm tabular-nums">{percent}%</span>
          ) : null}
        </div>

        {hasFiniteLimit ? <Progress className={cn('mt-3 h-2', progressClassName)} value={percent} /> : null}

        {subtext ? <p className="mt-2 text-muted-foreground text-xs">{subtext}</p> : null}
      </div>

      {action ? <div className="mt-4 flex justify-end border-t pt-4">{action}</div> : null}
    </div>
  );
};

export const OrganisationUsagePanel = ({
  organisationId,
  monthlyStats,
  organisationClaim,
  capacityUsage,
}: OrganisationUsagePanelProps) => {
  const monthlyUsagePeriodId = useId();
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(() => monthlyStats[0]?.period);

  const selectedStat = monthlyStats.find((stat) => stat.period === selectedPeriod) ?? monthlyStats[0];

  // Resetting a counter only affects the current month (the server hardcodes the
  // current period), so only offer the reset action when viewing the current month.
  const isCurrentPeriod = selectedStat?.period === currentMonthlyPeriod();

  const capacityRows = capacityUsage
    ? [
        {
          key: 'members',
          label: <Trans>Members</Trans>,
          icon: UsersIcon,
          used: capacityUsage.members,
          limit: normalizeCapacityLimit(organisationClaim.memberCount),
        },
        {
          key: 'teams',
          label: <Trans>Teams</Trans>,
          icon: UsersRoundIcon,
          used: capacityUsage.teams,
          limit: normalizeCapacityLimit(organisationClaim.teamCount),
        },
      ]
    : [];

  const monthlyRows: UsageRow[] = [
    {
      counter: 'document',
      label: <Trans>Documents</Trans>,
      icon: FileIcon,
      used: selectedStat?.documentCount ?? 0,
      effectiveLimit: organisationClaim.documentQuota,
    },
    {
      counter: 'email',
      label: <Trans>Emails</Trans>,
      icon: MailIcon,
      used: selectedStat?.emailCount ?? 0,
      effectiveLimit: organisationClaim.emailQuota,
    },
    {
      counter: 'api',
      label: <Trans>API requests</Trans>,
      icon: PlugIcon,
      used: selectedStat?.apiCount ?? 0,
      effectiveLimit: organisationClaim.apiQuota,
    },
  ];

  return (
    <div className="mt-4 space-y-6">
      {capacityRows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {capacityRows.map((row) => (
            <UsageStatCard key={row.key} label={row.label} icon={row.icon} used={row.used} limit={row.limit} />
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 id={monthlyUsagePeriodId} className="font-semibold text-base">
            <Trans>Monthly usage</Trans>
          </h3>

          {monthlyStats.length > 0 ? (
            <Select value={selectedStat?.period} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="h-9 w-full sm:w-44" aria-labelledby={monthlyUsagePeriodId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthlyStats.map((stat) => (
                  <SelectItem key={stat.period} value={stat.period}>
                    {stat.period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {monthlyRows.map((row) => (
            <UsageStatCard
              key={row.counter}
              label={row.label}
              icon={row.icon}
              used={row.used}
              limit={row.effectiveLimit}
              action={
                selectedStat && isCurrentPeriod ? (
                  <OrganisationUsageResetButton organisationId={organisationId} counter={row.counter} />
                ) : undefined
              }
            />
          ))}

          <UsageStatCard
            label={<Trans>Reports</Trans>}
            icon={MailOpenIcon}
            used={selectedStat?.emailReports ?? 0}
            limit={null}
            countOnly
            footnote={<Trans>Sent this period</Trans>}
          />
        </div>
      </div>
    </div>
  );
};
