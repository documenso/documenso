import { Progress } from '@documenso/ui/primitives/progress';

import { Trans } from '@lingui/react/macro';
import type { OrganisationClaim, OrganisationMonthlyStat } from '@prisma/client';
import { match } from 'ts-pattern';
import { OrganisationUsageResetButton } from './organisation-usage-reset-button';

type OrganisationUsagePanelProps = {
  organisationId: string;
  monthlyStats: Pick<OrganisationMonthlyStat, 'period' | 'documentCount' | 'emailCount' | 'apiCount'>[];
  organisationClaim: OrganisationClaim;
};

export const OrganisationUsagePanel = ({
  organisationId,
  monthlyStats,
  organisationClaim,
}: OrganisationUsagePanelProps) => {
  const rows = [
    {
      counter: 'document' as const,
      label: <Trans>Documents</Trans>,
      used: monthlyStats[0]?.documentCount ?? 0,
      effectiveLimit: organisationClaim.documentQuota,
    },
    {
      counter: 'email' as const,
      label: <Trans>Emails</Trans>,
      used: monthlyStats[0]?.emailCount ?? 0,
      effectiveLimit: organisationClaim.emailQuota,
    },
    {
      counter: 'api' as const,
      label: <Trans>API requests</Trans>,
      used: monthlyStats[0]?.apiCount ?? 0,
      effectiveLimit: organisationClaim.apiQuota,
    },
  ];

  // Todo: This may not show if the organisation has no usage data for the current month.
  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <h3 className="font-medium text-sm">
          <Trans>Usage for period: {monthlyStats[0]?.period || 'N/A'}</Trans>
        </h3>
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

            {monthlyStats[0] && (
              <div className="flex w-full justify-end pt-1">
                <OrganisationUsageResetButton organisationId={organisationId} counter={row.counter} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
