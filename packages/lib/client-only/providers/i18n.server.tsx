import 'server-only';

import { cookies, headers } from 'next/headers';

import type { I18n, Messages } from '@lingui/core';
import { setupI18n } from '@lingui/core';
import { setI18n } from '@lingui/react/server';

import { IS_APP_WEB } from '../../constants/app';
import { SUPPORTED_LANGUAGE_CODES } from '../../constants/i18n';
import { extractLocaleData } from '../../utils/i18n';

type SupportedLanguages = (typeof SUPPORTED_LANGUAGE_CODES)[number];

async function loadCatalog(lang: SupportedLanguages): Promise<{
  [k: string]: Messages;
}> {
  const extension = process.env.NODE_ENV === 'development' ? 'po' : 'js';
  const context = IS_APP_WEB ? 'web' : 'marketing';

  const { messages } = await import(`../../translations/${lang}/${context}.${extension}`);

  return {
    [lang]: messages,
  };
}

const catalogs = await Promise.all(SUPPORTED_LANGUAGE_CODES.map(loadCatalog));

// transform array of catalogs into a single object
export const allMessages = catalogs.reduce((acc, oneCatalog) => {
  return { ...acc, ...oneCatalog };
}, {});

type AllI18nInstances = { [K in SupportedLanguages]: I18n };

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const allI18nInstances = SUPPORTED_LANGUAGE_CODES.reduce((acc, lang) => {
  const messages = allMessages[lang] ?? {};

  const i18n = setupI18n({
    locale: lang,
    messages: { [lang]: messages },
  });

  return { ...acc, [lang]: i18n };
}, {}) as AllI18nInstances;

/**
 * This needs to be run in all layouts and page server components that require i18n.
 *
 * https://lingui.dev/tutorials/react-rsc#pages-layouts-and-lingui
 */
export const setupI18nSSR = () => {
  const { lang, locales } = extractLocaleData({
    cookies: cookies(),
    headers: headers(),
  });

  // Get and set a ready-made i18n instance for the given language.
  const i18n = allI18nInstances[lang];

  // Reactivate the i18n instance with the locale for date and number formatting.
  i18n.activate(lang, locales);

  setI18n(i18n);

  return {
    lang,
    locales,
    i18n,
  };
};
