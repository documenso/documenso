import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import type { I18n } from '@lingui/core';

import { IS_APP_WEB } from '../constants/app';
import type { SupportedLanguageCodes } from '../constants/i18n';
import { APP_I18N_OPTIONS } from '../constants/i18n';

export async function dynamicActivate(i18nInstance: I18n, locale: string) {
  const { messages } = await import(
    `../translations/${locale}/${IS_APP_WEB ? 'web' : 'marketing'}.js`
  );

  i18nInstance.loadAndActivate({ locale, messages });
}

/**
 * Extract the language if supported from the cookies header.
 *
 * Returns `null` if not supported or not found.
 */
export const extractSupportedLanguageFromCookies = (
  cookies: ReadonlyRequestCookies,
): SupportedLanguageCodes | null => {
  const preferredLanguage = cookies.get('i18n');

  const foundSupportedLanguage = APP_I18N_OPTIONS.supportedLangs.find(
    (lang): lang is SupportedLanguageCodes => lang === preferredLanguage?.value,
  );

  return foundSupportedLanguage || null;
};

/**
 * Extracts the language from the `accept-language` header.
 *
 * Returns `null` if not supported or not found.
 */
export const extractSupportedLanguageFromHeaders = (
  headers: Headers,
): SupportedLanguageCodes | null => {
  const locales = headers.get('accept-language') ?? '';

  const [locale] = locales.split(',');

  // Convert locale to language.
  const [language] = locale.split('-');

  const foundSupportedLanguage = APP_I18N_OPTIONS.supportedLangs.find(
    (lang): lang is SupportedLanguageCodes => lang === language,
  );

  return foundSupportedLanguage || null;
};

type ExtractSupportedLanguageOptions = {
  headers?: Headers;
  cookies?: ReadonlyRequestCookies;
};

/**
 * Extract the supported language from the cookies, then header if not found.
 *
 * Will return the default fallback language if not found.
 */
export const extractSupportedLanguage = ({
  headers,
  cookies,
}: ExtractSupportedLanguageOptions): SupportedLanguageCodes => {
  if (cookies) {
    const langCookie = extractSupportedLanguageFromCookies(cookies);

    if (langCookie) {
      return langCookie;
    }
  }

  if (headers) {
    const langHeader = extractSupportedLanguageFromHeaders(headers);

    if (langHeader) {
      return langHeader;
    }
  }

  return APP_I18N_OPTIONS.sourceLang;
};
