import { StrictMode, startTransition } from 'react';

import { i18n } from '@lingui/core';
import { detect, fromHtmlTag } from '@lingui/detect-locale';
import { I18nProvider } from '@lingui/react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { Theme, ThemeProvider } from 'remix-themes';
import { match } from 'ts-pattern';

import { dynamicActivate } from '@documenso/lib/utils/i18n';

async function main() {
  const theme = match(document.documentElement.getAttribute('data-theme'))
    .with('dark', () => Theme.DARK)
    .with('light', () => Theme.LIGHT)
    .otherwise(() => null);

  const locale = detect(fromHtmlTag('lang')) || 'en';

  await dynamicActivate(locale);

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <ThemeProvider specifiedTheme={theme} themeAction="/api/theme">
            <HydratedRouter />
          </ThemeProvider>
        </I18nProvider>
      </StrictMode>,
    );
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
