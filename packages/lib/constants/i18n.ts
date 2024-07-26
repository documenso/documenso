import { z } from 'zod';

export const SUPPORTED_LANGUAGE_CODES = ['de', 'en'] as const;

export const ZSupportedLanguageCodeSchema = z.enum(SUPPORTED_LANGUAGE_CODES).catch('en');

export type SupportedLanguageCodes = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const APP_I18N_OPTIONS = {
  supportedLangs: SUPPORTED_LANGUAGE_CODES,
  sourceLang: 'en',
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
} satisfies Record<SupportedLanguageCodes, SupportedLanguage>;
