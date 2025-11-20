import { z } from 'zod';

export const SUPPORTED_LANGUAGE_CODES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'pl',
  'pt-BR',
  'ja',
  'ko',
  'zh',
] as const;

export const ZSupportedLanguageCodeSchema = z.enum(SUPPORTED_LANGUAGE_CODES).catch('en');

export type SupportedLanguageCodes = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export type I18nLocaleData = {
  /**
   * The supported language extracted from the locale.
   */
  lang: SupportedLanguageCodes;

  /**
   * The preferred locales.
   */
  locales: string[];
};

export const APP_I18N_OPTIONS = {
  supportedLangs: SUPPORTED_LANGUAGE_CODES,
  sourceLang: 'en',
  defaultLocale: 'en-US',
} as const;

type SupportedLanguage = {
  full: string;
  short: string;
};

export const SUPPORTED_LANGUAGES: Record<string, SupportedLanguage> = {
  de: {
    full: 'German',
    short: 'de',
  },
  en: {
    full: 'English',
    short: 'en',
  },
  fr: {
    full: 'French',
    short: 'fr',
  },
  es: {
    full: 'Spanish',
    short: 'es',
  },
  it: {
    full: 'Italian',
    short: 'it',
  },
  pl: {
    short: 'pl',
    full: 'Polish',
  },
  'pt-BR': {
    short: 'pt-BR',
    full: 'Portuguese (Brazil)',
  },
  ja: {
    short: 'ja',
    full: 'Japanese',
  },
  ko: {
    short: 'ko',
    full: 'Korean',
  },
  zh: {
    short: 'zh',
    full: 'Chinese',
  },
} satisfies Record<SupportedLanguageCodes, SupportedLanguage>;

export const isValidLanguageCode = (code: unknown): code is SupportedLanguageCodes =>
  SUPPORTED_LANGUAGE_CODES.includes(code as SupportedLanguageCodes);
