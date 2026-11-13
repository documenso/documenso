import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

export type AnalyticsQueryErrorProps = {
  onRetry: () => Promise<unknown>;
  className?: string;
};

export const AnalyticsQueryError = ({ onRetry, className }: AnalyticsQueryErrorProps) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Alert variant="neutral" padding="tight" className={className} data-testid="analytics-error">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <Trans>This data could not be loaded.</Trans>
        </span>

        <Button variant="outline" size="sm" onClick={() => void handleRetry()} loading={isRetrying}>
          <Trans>Retry</Trans>
        </Button>
      </AlertDescription>
    </Alert>
  );
};
