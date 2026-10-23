import { describe, expect, it, vi } from 'vitest';

vi.mock('@lingui/core', () => ({
  i18n: {
    loadAndActivate: () => {},
  },
}));

import {
  extractLocaleData,
  extractLocaleDataFromHeaders,
  parseLanguageFromLocale,
} from './i18n';

describe('parseLanguageFromLocale', () => {
  it('correctly matches regional language codes like pt-BR', () => {
    expect(parseLanguageFromLocale('pt-BR')).toBe('pt-BR');
    expect(parseLanguageFromLocale('pt-br')).toBe('pt-BR');
    expect(parseLanguageFromLocale('pt-BR;q=0.9')).toBe('pt-BR');
  });

  it('matches base language requests to regional supported code when only regional exists', () => {
    expect(parseLanguageFromLocale('pt')).toBe('pt-BR');
    expect(parseLanguageFromLocale('pt;q=0.8')).toBe('pt-BR');
    expect(parseLanguageFromLocale('pt-PT')).toBe('pt-BR');
  });

  it('matches regional tags to supported base language codes', () => {
    expect(parseLanguageFromLocale('en-US')).toBe('en');
    expect(parseLanguageFromLocale('en-GB')).toBe('en');
    expect(parseLanguageFromLocale('de-DE')).toBe('de');
    expect(parseLanguageFromLocale('fr-FR')).toBe('fr');
    expect(parseLanguageFromLocale('es-ES')).toBe('es');
  });

  it('matches standalone supported language codes', () => {
    expect(parseLanguageFromLocale('en')).toBe('en');
    expect(parseLanguageFromLocale('de')).toBe('de');
    expect(parseLanguageFromLocale('ja')).toBe('ja');
    expect(parseLanguageFromLocale('zh')).toBe('zh');
  });

  it('returns null for unsupported language codes or empty strings', () => {
    expect(parseLanguageFromLocale('xx-YY')).toBeNull();
    expect(parseLanguageFromLocale('unknown')).toBeNull();
    expect(parseLanguageFromLocale('')).toBeNull();
    expect(parseLanguageFromLocale('  ')).toBeNull();
  });
});

describe('extractLocaleDataFromHeaders', () => {
  it('extracts pt-BR from Accept-Language header', () => {
    const headers = new Headers({
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    const result = extractLocaleDataFromHeaders(headers);
    expect(result.lang).toBe('pt-BR');
  });

  it('extracts base language en from Accept-Language header', () => {
    const headers = new Headers({
      'accept-language': 'en-US,en;q=0.9',
    });

    const result = extractLocaleDataFromHeaders(headers);
    expect(result.lang).toBe('en');
  });
});

describe('extractLocaleData', () => {
  it('resolves pt-BR when requested with fallback chain', () => {
    const headers = new Headers({
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
    });

    const result = extractLocaleData({ headers });
    expect(result.lang).toBe('pt-BR');
  });

  it('resolves pt to pt-BR', () => {
    const headers = new Headers({
      'accept-language': 'pt,en;q=0.8',
    });

    const result = extractLocaleData({ headers });
    expect(result.lang).toBe('pt-BR');
  });

  it('falls back to sourceLang when no supported language is in header', () => {
    const headers = new Headers({
      'accept-language': 'xx-YY,zz;q=0.8',
    });

    const result = extractLocaleData({ headers });
    expect(result.lang).toBe('en');
  });
});
