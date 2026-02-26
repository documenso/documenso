export const SUPPORTED_LANGUAGE_CODES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'pt-BR',
  'ja',
  'ko',
  'zh',
] as const;

export type SupportedLanguageCodes = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const APP_I18N_OPTIONS = {
  supportedLangs: SUPPORTED_LANGUAGE_CODES,
  sourceLang: 'en',
  defaultLocale: 'en-US',
} as const;
