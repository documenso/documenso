import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';

import { render } from '@documenso/email/render';

import type { SupportedLanguageCodes } from '../constants/i18n';

export const renderEmailWithI18N = async (
  lang: SupportedLanguageCodes,
  Component: () => React.ReactElement,
  options?: { plainText?: boolean },
) => {
  try {
    const { allI18nInstances } = await import('../client-only/providers/i18n.server');

    const instance = allI18nInstances[lang];

    instance.activate(lang);

    console.log({ instance });

    const i18n = setupI18n({
      locale: lang,
      locales: [lang],
      messages: { [lang]: instance.messages },
    });

    console.log(JSON.stringify({ messages: instance.messages }, null, 2));

    // setI18n(i18n);

    return await render(
      <I18nProvider i18n={i18n}>
        <Component />
      </I18nProvider>,
    );
  } catch (err) {
    console.error(err);
    throw new Error('Failed to render email');
  }
};
