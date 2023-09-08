import { posthog } from 'posthog-js';

import { extractPostHogConfig } from '@documenso/lib/constants/feature-flags';

export function useAnalytics() {
  const isPostHogEnabled = extractPostHogConfig();

  const capture = (event: string, properties?: Record<string, unknown>) => {
    if (!isPostHogEnabled) {
      return;
    }

    posthog.capture(event, properties);
  };

  return {
    capture,
  };
}
