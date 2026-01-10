import { z } from 'zod';

/**
 * Supported language codes for the application.
 * To add a new language:
 * 1. Add code here
 * 2. Add metadata to SUPPORTED_LANGUAGES
 * 3. Create translation file in the messages directory
 */
export const SUPPORTED_LANGUAGE_CODES = [
  'de',
  'en',
  'es',
  'fr',
  'it',
  'ja',
  'ko',
  'nl',
  'pl',
  'pt-BR',
  'pt-PT',
  'zh',
] as const;

export type SupportedLanguageCodes = (typeof SUPPORTED_LANGUAGE_CODES)[number];

/**
 * Validates language code with fallback to English.
 * @example
 * ZSupportedLanguageCodeSchema.parse('pt-BR') // 'pt-BR'
 * ZSupportedLanguageCodeSchema.parse('invalid') // 'en'
 */
export const ZSupportedLanguageCodeSchema = z.enum(SUPPORTED_LANGUAGE_CODES).catch('en');

export type I18nLocaleData = {
  /** The supported language extracted from the locale */
  lang: SupportedLanguageCodes;
  /** The preferred locales */
  locales: string[];
};

export const APP_I18N_OPTIONS = {
  supportedLangs: SUPPORTED_LANGUAGE_CODES,
  sourceLang: 'en',
  defaultLocale: 'en-US',
} as const;

type LanguageMetadata = {
  /** English name of the language */
  name: string;
  /** Native name of the language */
  nativeName?: string;
};

/**
 * Metadata for each supported language.
 * Keys must match SUPPORTED_LANGUAGE_CODES.
 */
export const SUPPORTED_LANGUAGES: Record<SupportedLanguageCodes, LanguageMetadata> = {
  de: { name: 'German', nativeName: 'Deutsch' },
  en: { name: 'English', nativeName: 'English' },
  es: { name: 'Spanish', nativeName: 'Español' },
  fr: { name: 'French', nativeName: 'Français' },
  it: { name: 'Italian', nativeName: 'Italiano' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  ko: { name: 'Korean', nativeName: '한국어' },
  nl: { name: 'Dutch', nativeName: 'Nederlands' },
  pl: { name: 'Polish', nativeName: 'Polski' },
  'pt-BR': { name: 'Português (Brasil)' },
  'pt-PT': { name: 'Português (Portugal)' },
  zh: { name: 'Chinese', nativeName: '中文' },
};

/**
 * Type guard to check if a value is a valid language code.
 */
export const isValidLanguageCode = (code: unknown): code is SupportedLanguageCodes =>
  SUPPORTED_LANGUAGE_CODES.includes(code as SupportedLanguageCodes);
