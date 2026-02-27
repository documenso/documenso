import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { z } from 'zod';

import { SUPPORTED_LANGUAGE_CODES, type SupportedLanguageCodes } from './locales';

export * from './locales';

export const ZSupportedLanguageCodeSchema = z.enum(SUPPORTED_LANGUAGE_CODES).catch('en');

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

type SupportedLanguage = {
  short: string;
  full: MessageDescriptor;
};

export const SUPPORTED_LANGUAGES: Record<string, SupportedLanguage> = {
  de: {
    short: 'de',
    full: msg`German`,
  },
  en: {
    short: 'en',
    full: msg`English`,
  },
  fr: {
    short: 'fr',
    full: msg`French`,
  },
  es: {
    short: 'es',
    full: msg`Spanish`,
  },
  it: {
    short: 'it',
    full: msg`Italian`,
  },
  nl: {
    short: 'nl',
    full: msg`Dutch`,
  },
  pl: {
    short: 'pl',
    full: msg`Polish`,
  },
  'pt-BR': {
    short: 'pt-BR',
    full: msg`Portuguese (Brazil)`,
  },
  ja: {
    short: 'ja',
    full: msg`Japanese`,
  },
  ko: {
    short: 'ko',
    full: msg`Korean`,
  },
  zh: {
    short: 'zh',
    full: msg`Chinese`,
  },
} satisfies Record<SupportedLanguageCodes, SupportedLanguage>;

export const isValidLanguageCode = (code: unknown): code is SupportedLanguageCodes =>
  SUPPORTED_LANGUAGE_CODES.includes(code as SupportedLanguageCodes);
