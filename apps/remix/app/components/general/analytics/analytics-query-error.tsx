import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';

export type AnalyticsQueryErrorProps = {
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
};

export const AnalyticsQueryError = ({ onRetry, isRetrying = false, className }: AnalyticsQueryErrorProps) => {
  return (
    <Alert variant="neutral" padding="tight" className={className} data-testid="analytics-error">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <Trans>This data could not be loaded.</Trans>
        </span>

        <Button variant="outline" size="sm" onClick={onRetry} loading={isRetrying}>
          <Trans>Retry</Trans>
        </Button>
      </AlertDescription>
    </Alert>
  );
};
