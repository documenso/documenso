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
function initPosthog() {
  const postHogConfig = extractPostHogConfig();

  if (postHogConfig) {
    void import('posthog-js').then(({ default: posthog }) => {
      posthog.init(postHogConfig.key, {
        api_host: postHogConfig.host,
        capture_exceptions: true,
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
