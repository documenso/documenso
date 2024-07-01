import 'server-only';

import type { Locale } from '@documenso/lib/internationalization/i18n-config';

// We enumerate all dictionaries here for better linting and typescript support
// We also get the default import for cleaner types
const dictionaries = {
  en: async () => import('./dictionaries/en.json').then((module) => module.default),
  fr: async () => import('./dictionaries/fr.json').then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => {
  if (!dictionaries[locale]) {
    console.warn(`Locale ${locale} not supported, defaulting to English.`);
  }
  return dictionaries[locale]?.() ?? dictionaries.en();
};
