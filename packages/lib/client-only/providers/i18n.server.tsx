import 'server-only';

import { cookies } from 'next/headers';

import type { I18n, Messages } from '@lingui/core';
import { setupI18n } from '@lingui/core';
import { setI18n } from '@lingui/react/server';

import { IS_APP_WEB, IS_APP_WEB_I18N_ENABLED } from '../../constants/app';
import { SUPPORTED_LANGUAGE_CODES } from '../../constants/i18n';
import { extractSupportedLanguage } from '../../utils/i18n';

type SupportedLocales = (typeof SUPPORTED_LANGUAGE_CODES)[number];

async function loadCatalog(locale: SupportedLocales): Promise<{
  [k: string]: Messages;
}> {
  const { messages } = await import(
    `../../translations/${locale}/${IS_APP_WEB ? 'web' : 'marketing'}.js`
  );

  return {
    [locale]: messages,
  };
}

const catalogs = await Promise.all(SUPPORTED_LANGUAGE_CODES.map(loadCatalog));

// transform array of catalogs into a single object
export const allMessages = catalogs.reduce((acc, oneCatalog) => {
  return { ...acc, ...oneCatalog };
}, {});

type AllI18nInstances = { [K in SupportedLocales]: I18n };

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const allI18nInstances = SUPPORTED_LANGUAGE_CODES.reduce((acc, locale) => {
  const messages = allMessages[locale] ?? {};

  const i18n = setupI18n({
    locale,
    messages: { [locale]: messages },
  });

  return { ...acc, [locale]: i18n };
}, {}) as AllI18nInstances;

/**
 * This needs to be run in all layouts and page server components that require i18n.
 *
 * https://lingui.dev/tutorials/react-rsc#pages-layouts-and-lingui
 */
export const setupI18nSSR = (overrideLang?: SupportedLocales) => {
  let lang =
    overrideLang ||
    extractSupportedLanguage({
      cookies: cookies(),
    });

  // Override web app to be English.
  if (!IS_APP_WEB_I18N_ENABLED && IS_APP_WEB) {
    lang = 'en';
  }

  // Get and set a ready-made i18n instance for the given language.
  const i18n = allI18nInstances[lang];
  setI18n(i18n);

  return {
    lang,
    i18n,
  };
};
