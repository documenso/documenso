'use client';

import { useEffect } from 'react';

import { usePathname, useSearchParams } from 'next/navigation';

import { getSession } from 'next-auth/react';
import posthog from 'posthog-js';

import { extractPostHogConfig } from '@documenso/lib/constants/feature-flags';

export function PostHogPageview() {
  const postHogConfig = extractPostHogConfig();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (typeof window !== 'undefined' && postHogConfig) {
    posthog.init(postHogConfig.key, {
      api_host: postHogConfig.host,
      disable_session_recording: true,
      loaded: () => {
        getSession()
          .then((session) => {
            if (session) {
              posthog.identify(session.user.email ?? session.user.id.toString());
            } else {
              posthog.reset();
            }
          })
          .catch(() => {
            // Do nothing.
          });
      },
      custom_campaign_params: ['src'],
    });
  }

  useEffect(() => {
    if (!postHogConfig || !pathname) {
      return;
    }

    let url = window.origin + pathname;
    if (searchParams && searchParams.toString()) {
      url = url + `?${searchParams.toString()}`;
    }
    posthog.capture('$pageview', {
      $current_url: url,
    });
  }, [pathname, searchParams, postHogConfig]);

  return null;
}
