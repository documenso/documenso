import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { Trans } from '@lingui/react/macro';

/**
 * Shown while the analytics route's `clientLoader` resolves the browser timezone
 * during hydration.
 */
export const AnalyticsHydrateFallback = () => {
  return (
    <div role="status" aria-live="polite" data-testid="analytics-loading">
      <SpinnerBox />
      <span className="sr-only">
        <Trans>Loading analytics</Trans>
      </span>
    </div>
  );
};
