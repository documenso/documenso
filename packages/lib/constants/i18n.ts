import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
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
  'sq',
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
  /** Translatable name of the language */
  name: MessageDescriptor;
  /** Native name of the language */
  nativeName?: string;
};

/**
 * Metadata for each supported language.
 * Keys must match SUPPORTED_LANGUAGE_CODES.
 */
export const SUPPORTED_LANGUAGES: Record<SupportedLanguageCodes, LanguageMetadata> = {
  de: { name: msg({ message: 'German', context: 'Language name' }), nativeName: 'Deutsch' },
  en: { name: msg({ message: 'English', context: 'Language name' }), nativeName: 'English' },
  es: { name: msg({ message: 'Spanish', context: 'Language name' }), nativeName: 'Español' },
  fr: { name: msg({ message: 'French', context: 'Language name' }), nativeName: 'Français' },
  it: { name: msg({ message: 'Italian', context: 'Language name' }), nativeName: 'Italiano' },
  ja: { name: msg({ message: 'Japanese', context: 'Language name' }), nativeName: '日本語' },
  ko: { name: msg({ message: 'Korean', context: 'Language name' }), nativeName: '한국어' },
  nl: { name: msg({ message: 'Dutch', context: 'Language name' }), nativeName: 'Nederlands' },
  pl: { name: msg({ message: 'Polish', context: 'Language name' }), nativeName: 'Polski' },
  'pt-BR': {
    name: msg({ message: 'Portuguese (Brazil)', context: 'Language name' }),
    nativeName: 'Português (Brasil)',
  },
  'pt-PT': {
    name: msg({ message: 'Portuguese (Portugal)', context: 'Language name' }),
    nativeName: 'Português (Portugal)',
  },
  zh: { name: msg({ message: 'Chinese', context: 'Language name' }), nativeName: '中文' },
};

/**
 * Type guard to check if a value is a valid language code.
 */
export const isValidLanguageCode = (code: unknown): code is SupportedLanguageCodes =>
  SUPPORTED_LANGUAGE_CODES.includes(code as SupportedLanguageCodes);
