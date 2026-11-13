import type { TTeamAnalyticsRange } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { InfoIcon } from 'lucide-react';

import { ANALYTICS_NO_ACTIVITY_LABELS } from '~/utils/analytics';

export type AnalyticsNoActivityAlertProps = {
  range: TTeamAnalyticsRange;
  /** Invoked when the user asks to widen the range to the last 12 months. */
  onShowLastYear: () => void;
};

export const AnalyticsNoActivityAlert = ({ range, onShowLastYear }: AnalyticsNoActivityAlertProps) => {
  const { _ } = useLingui();

  const canWidenRange = range !== '12m';

  return (
    <Alert variant="neutral" padding="tight" className="mt-6" data-testid="analytics-no-activity">
      <AlertDescription className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex items-center gap-x-2">
          <InfoIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {_(ANALYTICS_NO_ACTIVITY_LABELS[range])}
            {canWidenRange && (
              <>
                {' '}
                <Trans>Try a longer range.</Trans>
              </>
            )}
          </span>
        </span>

        {canWidenRange && (
          <Button variant="ghost" size="sm" className="-mr-2" onClick={onShowLastYear}>
            <Trans>Show last 12 months</Trans>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};
