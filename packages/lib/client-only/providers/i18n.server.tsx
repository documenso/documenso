import 'server-only';

import { cookies, headers } from 'next/headers';

import type { I18n, Messages } from '@lingui/core';
import { setupI18n } from '@lingui/core';
import { setI18n } from '@lingui/react/server';

import { IS_APP_WEB } from '../../constants/app';
import {
  APP_I18N_OPTIONS,
  SUPPORTED_LANGUAGE_CODES,
  isValidLanguageCode,
} from '../../constants/i18n';
import { extractLocaleData } from '../../utils/i18n';
import { remember } from '../../utils/remember';

type SupportedLanguages = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export async function loadCatalog(lang: SupportedLanguages): Promise<{
  [k: string]: Messages;
}> {
  const extension = process.env.NODE_ENV === 'development' ? 'po' : 'js';
  const context = IS_APP_WEB ? 'web' : 'marketing';

  let { messages } = await import(`../../translations/${lang}/${context}.${extension}`);

  if (extension === 'po') {
    const { messages: commonMessages } = await import(
      `../../translations/${lang}/common.${extension}`
    );

    messages = { ...messages, ...commonMessages };
  }

  return {
    [lang]: messages,
  };
}

const catalogs = Promise.all(SUPPORTED_LANGUAGE_CODES.map(loadCatalog));

// transform array of catalogs into a single object
const allMessages = async () => {
  return await catalogs.then((catalogs) =>
    catalogs.reduce((acc, oneCatalog) => {
      return {
        ...acc,
        ...oneCatalog,
      };
    }, {}),
  );
};

type AllI18nInstances = { [K in SupportedLanguages]: I18n };

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const allI18nInstances = remember('i18n.allI18nInstances', async () => {
  const loadedMessages = await allMessages();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return SUPPORTED_LANGUAGE_CODES.reduce((acc, lang) => {
    const messages = loadedMessages[lang] ?? {};

    const i18n = setupI18n({
      locale: lang,
      messages: { [lang]: messages },
    });

    return { ...acc, [lang]: i18n };
  }, {}) as AllI18nInstances;
});

// eslint-disable-next-line @typescript-eslint/ban-types
export const getI18nInstance = async (lang?: SupportedLanguages | (string & {})) => {
  const instances = await allI18nInstances;

  if (!isValidLanguageCode(lang)) {
    return instances[APP_I18N_OPTIONS.sourceLang];
  }

  return instances[lang] ?? instances[APP_I18N_OPTIONS.sourceLang];
};

/**
 * This needs to be run in all layouts and page server components that require i18n.
 *
 * https://lingui.dev/tutorials/react-rsc#pages-layouts-and-lingui
 */
export const setupI18nSSR = async () => {
  const { lang, locales } = extractLocaleData({
    cookies: cookies(),
    headers: headers(),
  });

  // Get and set a ready-made i18n instance for the given language.
  const i18n = await getI18nInstance(lang);

  // Reactivate the i18n instance with the locale for date and number formatting.
  i18n.activate(lang, locales);

  setI18n(i18n);

  return {
    lang,
    locales,
    i18n,
  };
};
