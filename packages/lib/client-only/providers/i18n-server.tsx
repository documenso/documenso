import type { I18n, Messages } from '@lingui/core';
import { setupI18n } from '@lingui/core';

import {
  APP_I18N_OPTIONS,
  SUPPORTED_LANGUAGE_CODES,
  isValidLanguageCode,
} from '../../constants/i18n';
import { env } from '../../utils/env';
import { remember } from '../../utils/remember';

type SupportedLanguages = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export async function loadCatalog(lang: SupportedLanguages): Promise<{
  [k: string]: Messages;
}> {
  const extension = env('NODE_ENV') === 'development' ? 'po' : 'mjs';

  const { messages } = await import(`../../translations/${lang}/web.${extension}`);

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
