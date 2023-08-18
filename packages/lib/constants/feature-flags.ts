/**
 * How frequent to poll for new feature flags in milliseconds.
 */
export const FEATURE_FLAG_POLL_INTERVAL = 30000;

/**
 * Feature flags that will be used when PostHog is disabled.
 *
 * Does not take any person or group properties into account.
 */
export const LOCAL_FEATURE_FLAGS: Record<string, boolean> = {
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true',
} as const;

/**
 * Extract the PostHog configuration from the environment.
 */
export function extractPostHogConfig(): { key: string; host: string } | null {
  const postHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!postHogKey || !postHogHost) {
    return null;
  }

  return {
    key: postHogKey,
    host: postHogHost,
  };
}

/**
 * Whether feature flags are enabled for the current instance.
 */
export function isFeatureFlagEnabled(): boolean {
  return extractPostHogConfig() !== null;
}
