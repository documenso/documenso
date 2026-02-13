import type { I18n, MessageDescriptor } from '@lingui/core';
import { i18n } from '@lingui/core';
import type { MacroMessageDescriptor } from '@lingui/core/macro';

import type { I18nLocaleData, SupportedLanguageCodes } from '../constants/i18n';
import { APP_I18N_OPTIONS } from '../constants/i18n';
import { env } from './env';

export async function getTranslations(locale: string) {
  const extension = env('NODE_ENV') === 'development' ? 'po' : 'mjs';

  const { messages } = await import(`../translations/${locale}/web.${extension}`);

  return messages;
}

export async function dynamicActivate(locale: string) {
  const messages = await getTranslations(locale);

  i18n.loadAndActivate({ locale, messages });
}

/**
 * Maps browser language codes to our supported language codes.
 * Handles both full locales (pt-BR) and language-only codes (pt).
 */
const BROWSER_LANGUAGE_MAP: Record<string, SupportedLanguageCodes> = {
  'de': 'de',
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
  'en': 'en',
  'en-US': 'en',
  'en-GB': 'en',
  'en-CA': 'en',
  'en-AU': 'en',
  'es': 'es',
  'es-ES': 'es',
  'es-MX': 'es',
  'es-AR': 'es',
  'fr': 'fr',
  'fr-FR': 'fr',
  'fr-CA': 'fr',
  'fr-BE': 'fr',
  'it': 'it',
  'it-IT': 'it',
  'ja': 'ja',
  'ja-JP': 'ja',
  'ko': 'ko',
  'ko-KR': 'ko',
  'nl': 'nl',
  'nl-NL': 'nl',
  'nl-BE': 'nl',
  'pl': 'pl',
  'pl-PL': 'pl',
  'pt': 'pt-BR',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT', // Map Portugal Portuguese to Portugal Portuguese
  'zh': 'zh',
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  'zh-HK': 'zh',
};

const parseLanguageFromLocale = (locale: string): SupportedLanguageCodes | null => {
  // Clean locale string (remove quality values like ;q=0.9)
  const cleanLocale = locale.split(';')[0].trim();

  // Try exact match first (e.g., 'pt-BR')
  const exactMatch = BROWSER_LANGUAGE_MAP[cleanLocale];
  if (exactMatch) {
    return exactMatch;
  }

  // Try language-only match (e.g., 'pt' from 'pt-BR')
  const langOnly = cleanLocale.split('-')[0];
  const langMatch = BROWSER_LANGUAGE_MAP[langOnly];
  if (langMatch) {
    return langMatch;
  }

  return null;
};

/**
 * Extracts the language from the `accept-language` header.
 */
export const extractLocaleDataFromHeaders = (
  headers: Headers,
): { lang: SupportedLanguageCodes | null; locales: string[] } => {
  const headerLocales = (headers.get('accept-language') ?? '').split(',');

  const language = parseLanguageFromLocale(headerLocales[0]);

  return {
    lang: language,
    locales: [headerLocales[0]],
  };
};

type ExtractLocaleDataOptions = {
  headers: Headers;
};

/**
 * Extract the supported language from the header.
 *
 * Will return the default fallback language if not found.
 */
export const extractLocaleData = ({ headers }: ExtractLocaleDataOptions): I18nLocaleData => {
  const headerLocales = (headers.get('accept-language') ?? '').split(',');

  const unknownLanguages = headerLocales
    .map((locale) => parseLanguageFromLocale(locale))
    .filter((value): value is SupportedLanguageCodes => value !== null);

  // Filter out locales that are not valid.
  const languages = (unknownLanguages ?? []).filter((language) => {
    try {
      new Intl.Locale(language);
      return true;
    } catch {
      return false;
    }
  });

  return {
    lang: languages[0] || APP_I18N_OPTIONS.sourceLang,
    locales: headerLocales,
  };
};

export const parseMessageDescriptor = (_: I18n['_'], value: string | MessageDescriptor) => {
  return typeof value === 'string' ? value : _(value);
};

export const parseMessageDescriptorMacro = (
  t: (descriptor: MacroMessageDescriptor) => string,
  value: string | MessageDescriptor,
) => {
  return typeof value === 'string' ? value : t(value);
};
