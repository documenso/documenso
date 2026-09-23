import { describe, expect, it } from 'vitest';

import { extractLocaleData, extractLocaleDataFromHeaders } from './i18n';

const headersWith = (acceptLanguage: string) => new Headers({ 'accept-language': acceptLanguage });

describe('extractLocaleData', () => {
  // Regression guard for #3090 (Accept-Language can never match pt-BR): a
  // region-qualified supported language must be matched instead of falling back.
  it('matches a region-qualified supported language (pt-BR)', () => {
    expect(extractLocaleData({ headers: headersWith('pt-BR') }).lang).toBe('pt-BR');
  });

  it('matches pt-BR even with a quality value and lower-priority locales', () => {
    expect(extractLocaleData({ headers: headersWith('pt-BR;q=0.9,en;q=0.8') }).lang).toBe('pt-BR');
  });

  it('matches a region-qualified locale case-insensitively', () => {
    expect(extractLocaleData({ headers: headersWith('pt-br') }).lang).toBe('pt-BR');
  });

  it('still falls back to the base language for region locales (en-US -> en)', () => {
    expect(extractLocaleData({ headers: headersWith('en-US') }).lang).toBe('en');
  });

  it('matches a plain supported language', () => {
    expect(extractLocaleData({ headers: headersWith('de') }).lang).toBe('de');
  });

  it('falls back to the source language for unsupported locales', () => {
    expect(extractLocaleData({ headers: headersWith('xx-YY') }).lang).toBe('en');
  });

  it('falls back to the source language when no accept-language is present', () => {
    expect(extractLocaleData({ headers: new Headers() }).lang).toBe('en');
  });
});

describe('extractLocaleDataFromHeaders', () => {
  it('matches a region-qualified supported language (pt-BR)', () => {
    expect(extractLocaleDataFromHeaders(headersWith('pt-BR,en;q=0.9')).lang).toBe('pt-BR');
  });

  it('returns null for an unsupported locale', () => {
    expect(extractLocaleDataFromHeaders(headersWith('xx-YY')).lang).toBeNull();
  });
});
