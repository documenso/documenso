import { StrictMode, startTransition } from 'react';

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

async function main() {
  // const locale = detect(fromHtmlTag('lang')) || 'en';

  // await dynamicActivate(locale);

  // await new Promise((resolve) => setTimeout(resolve, 100));

  // Todo: i18n
  const locale = 'en';

  // const { messages } = await import(`../../../packages/lib/translations/en/web.po`);
  // const { messages } = await import(`../../../packages/lib/translations/${locale}/web.po`);

  i18n.loadAndActivate({ locale, messages: {} });

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
}

void main();
