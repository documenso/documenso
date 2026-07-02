import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { Progress } from '@documenso/ui/primitives/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';

import { Trans } from '@lingui/react/macro';
import type { OrganisationClaim, OrganisationMonthlyStat } from '@prisma/client';
import { useState } from 'react';
import { match } from 'ts-pattern';
import { OrganisationUsageResetButton } from './organisation-usage-reset-button';

type OrganisationUsagePanelProps = {
  organisationId: string;
  monthlyStats: Pick<
    OrganisationMonthlyStat,
    'period' | 'documentCount' | 'emailCount' | 'apiCount' | 'emailReports'
  >[];
  organisationClaim: OrganisationClaim;
};

export const OrganisationUsagePanel = ({
  organisationId,
  monthlyStats,
  organisationClaim,
}: OrganisationUsagePanelProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(() => monthlyStats[0]?.period);

  const selectedStat = monthlyStats.find((stat) => stat.period === selectedPeriod) ?? monthlyStats[0];

  // Resetting a counter only affects the current month (the server hardcodes the
  // current period), so only offer the reset action when viewing the current month.
  const isCurrentPeriod = selectedStat?.period === currentMonthlyPeriod();

  const rows = [
    {
      counter: 'document' as const,
      label: <Trans>Documents</Trans>,
      used: selectedStat?.documentCount ?? 0,
      effectiveLimit: organisationClaim.documentQuota,
    },
    {
      counter: 'email' as const,
      label: <Trans>Emails</Trans>,
      used: selectedStat?.emailCount ?? 0,
      effectiveLimit: organisationClaim.emailQuota,
    },
    {
      counter: 'api' as const,
      label: <Trans>API requests</Trans>,
      used: selectedStat?.apiCount ?? 0,
      effectiveLimit: organisationClaim.apiQuota,
    },
  ];

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">
          <Trans>Usage for period: {selectedStat?.period || 'N/A'}</Trans>
        </h3>

        {monthlyStats.length > 0 && (
          <Select value={selectedStat?.period} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
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
        )}
      </div>

      {rows.map((row) => {
        const percent =
          row.effectiveLimit && row.effectiveLimit > 0
            ? Math.min(100, Math.round((row.used / row.effectiveLimit) * 100))
            : 0;

        return (
          <div key={row.counter} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{row.label}</span>
              <span className="text-muted-foreground">
                {row.used} /{' '}
                {match(row.effectiveLimit)
                  .with(null, () => <Trans>Unlimited</Trans>)
                  .with(0, () => <Trans>Blocked</Trans>)
                  .otherwise(String)}
              </span>
            </div>

            {row.effectiveLimit && row.effectiveLimit > 0 ? <Progress className="h-2 w-full" value={percent} /> : null}

            {selectedStat && isCurrentPeriod && (
              <div className="flex w-full justify-end pt-1">
                <OrganisationUsageResetButton organisationId={organisationId} counter={row.counter} />
              </div>
            )}
          </div>
        );
      })}

      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span>
            <Trans>Reports</Trans>
          </span>
          <span className="text-muted-foreground">{selectedStat?.emailReports ?? 0}</span>
        </div>
      </div>
    </div>
  );
};
