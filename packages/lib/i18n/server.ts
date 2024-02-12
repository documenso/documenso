import { cookies } from 'next/headers';

import { createInstance } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next/initReactI18next';

import type { Locales } from '@documenso/lib/i18n/settings';
import { FALLBACK_LOCALE, LANGUAGE_COOKIE, getOptions } from '@documenso/lib/i18n/settings';

async function initI18next(lang: Locales, namespace: string) {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        // Get the JSON file that matches the locale and namespace
        async (lang: string, ns: string) => import(`./locales/${lang}/${ns}.json`),
      ),
    )
    // Initialize i18next with the options we created earlier
    .init(getOptions(lang, namespace));

  return i18nInstance;
}

// This function will be used in our server components for the translation
export async function createTranslation(ns: string) {
  const lang = getLocale();
  const i18nextInstance = await initI18next(lang, ns);

  return {
    t: i18nextInstance.getFixedT(lang, Array.isArray(ns) ? ns[0] : ns),
  };
}

// Utility function to get the locale from server components
export function getLocale() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (cookies().get(LANGUAGE_COOKIE)?.value ?? FALLBACK_LOCALE) as Locales;
}
