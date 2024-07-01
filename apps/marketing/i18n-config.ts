export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  stringLocales: ['en-US', 'fr-FR'],
} as const;

export type Locale = (typeof i18n)['locales'][number];

export const getStringLocales = (locale: Locale) =>
  i18n.stringLocales.find((stringLocale) => stringLocale.startsWith(locale));

export type stringLocales = (typeof i18n)['stringLocales'][number];
