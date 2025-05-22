import { env } from '@documenso/lib/utils/env';

import { NEXT_PUBLIC_WEBAPP_URL } from './app';

const NEXT_PUBLIC_POSTHOG_KEY = () => env('NEXT_PUBLIC_POSTHOG_KEY');

/**
 * The flag name for global session recording feature flag.
 */
export const FEATURE_FLAG_GLOBAL_SESSION_RECORDING = 'global_session_recording';

/**
 * Extract the PostHog configuration from the environment.
 */
export function extractPostHogConfig(): { key: string; host: string } | null {
  const postHogKey = NEXT_PUBLIC_POSTHOG_KEY();
  const postHogHost = `${NEXT_PUBLIC_WEBAPP_URL()}/ingest`;

  if (!postHogKey || !postHogHost) {
    return null;
  }

  return {
    key: postHogKey,
    host: postHogHost,
  };
}
