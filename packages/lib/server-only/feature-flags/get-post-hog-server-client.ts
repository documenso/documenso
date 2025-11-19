import { PostHog } from 'posthog-node';

import { extractPostHogConfig } from '@doku-seal/lib/constants/feature-flags';

export default function PostHogServerClient() {
  const postHogConfig = extractPostHogConfig();

  if (!postHogConfig) {
    return null;
  }

  return new PostHog(postHogConfig.key, {
    host: postHogConfig.host,
    fetch: async (...args) => fetch(...args),
  });
}
