import { extractPostHogConfig } from '@documenso/lib/constants/feature-flags';
import { dynamicActivate } from '@documenso/lib/utils/i18n';
import { i18n } from '@lingui/core';
import { detect, fromHtmlTag } from '@lingui/detect-locale';
import { I18nProvider } from '@lingui/react';
import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import './utils/polyfills/promise-with-resolvers';

/**
 * Initialised imperatively (not as a component inside `hydrateRoot`) because
 * rendering extra client-only siblings changes the React tree structure
 * relative to the server render in `entry.server.tsx`. That shifts every
 * `useId` value (used by Radix for `id`/`htmlFor`/`aria-*`), causing hydration
 * mismatches which can abort hydration entirely when the user interacts with
 * the page early, leaving dead event handlers (broken dropdowns, native form
 * submits).
 */
/**
 * Signing and direct template URLs contain recipient tokens which must never
 * be sent to PostHog. Recipient context is attached explicitly via
 * `recipientId` where needed instead.
 */
const redactTokensFromUrl = (value: string) => {
  return value.replace(/(\/(?:sign|d|direct)\/)([^/?#]+)/g, '$1:token');
};

const URL_EVENT_PROPERTIES = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_referrer',
  '$prev_pageview_pathname',
] as const;

function initPosthog() {
  const postHogConfig = extractPostHogConfig();

  if (postHogConfig) {
    void import('posthog-js').then(({ default: posthog }) => {
      posthog.init(postHogConfig.key, {
        api_host: postHogConfig.host,
        // Only create person profiles for identified (authenticated) users,
        // anonymous recipients on signing pages stay anonymous.
        person_profiles: 'identified_only',
        // Explicit events only, autocapture on signing pages blows up usage
        // without providing actionable data.
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: false,
        capture_exceptions: true,
        before_send: (event) => {
          if (!event) {
            return null;
          }

          for (const property of URL_EVENT_PROPERTIES) {
            const value = event.properties?.[property];

            if (typeof value === 'string') {
              event.properties[property] = redactTokensFromUrl(value);
            }
          }

          if (event.$set_once && typeof event.$set_once['$initial_current_url'] === 'string') {
            event.$set_once['$initial_current_url'] = redactTokensFromUrl(event.$set_once['$initial_current_url']);
          }

          return event;
        },
      });
    });
  }
}

async function main() {
  const locale = detect(fromHtmlTag('lang')) || 'en';

  await dynamicActivate(locale);

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <HydratedRouter />
        </I18nProvider>
      </StrictMode>,
    );
  });

  void initPosthog();
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
