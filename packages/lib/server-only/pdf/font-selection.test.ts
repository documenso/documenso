import type { PDFDocument } from '@cantoo/pdf-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSignatureFontKey } from './font-selection';

describe('getSignatureFontKey', () => {
  it('should return caveat for Latin-only text', () => {
    expect(getSignatureFontKey('John Doe')).toBe('caveat');
    expect(getSignatureFontKey('Jane Smith')).toBe('caveat');
    expect(getSignatureFontKey('')).toBe('caveat');
  });

  it('should return noto-sans for Greek characters', () => {
    expect(getSignatureFontKey('Ελληνικά')).toBe('noto-sans');
    expect(getSignatureFontKey('αβγδ')).toBe('noto-sans');
    expect(getSignatureFontKey('Ωmega')).toBe('noto-sans');
  });

  it('should return caveat for Cyrillic characters (Caveat covers Cyrillic)', () => {
    expect(getSignatureFontKey('Кириллица')).toBe('caveat');
    expect(getSignatureFontKey('Иванов')).toBe('caveat');
  });

  it('should return noto-sans when Cyrillic is mixed with another non-Caveat script', () => {
    // Greek wins because Caveat cannot render it, so the whole signature
    // must fall back to a font that covers both.
    expect(getSignatureFontKey('Иван Ωmega')).toBe('noto-sans');
  });

  it('should return noto-sans for Arabic characters', () => {
    expect(getSignatureFontKey('عربي')).toBe('noto-sans');
  });

  it('should return noto-sans-korean for Korean characters', () => {
    expect(getSignatureFontKey('도큐멘소')).toBe('noto-sans-korean');
    expect(getSignatureFontKey('한글')).toBe('noto-sans-korean');
  });

  it('should return noto-sans-japanese for Japanese characters', () => {
    expect(getSignatureFontKey('こんにちは')).toBe('noto-sans-japanese');
    expect(getSignatureFontKey('カタカナ')).toBe('noto-sans-japanese');
  });

  it('should return noto-sans-chinese for Chinese characters', () => {
    expect(getSignatureFontKey('中文签名')).toBe('noto-sans-chinese');
    expect(getSignatureFontKey('签署')).toBe('noto-sans-chinese');
  });

  it('should prioritize Korean over CJK for mixed text', () => {
    expect(getSignatureFontKey('한글中文')).toBe('noto-sans-korean');
  });

  it('should prioritize Japanese over CJK for mixed text', () => {
    expect(getSignatureFontKey('ひらがな中文')).toBe('noto-sans-japanese');
  });

  it('should handle Latin + non-Latin mixed text', () => {
    expect(getSignatureFontKey('Hello 안녕')).toBe('noto-sans-korean');
    expect(getSignatureFontKey('Sign Ελληνικά')).toBe('noto-sans');
    expect(getSignatureFontKey('Name 中文')).toBe('noto-sans-chinese');
  });
});

// fetchSignatureFont and embedSignatureFont hold module-level caches, so each
// test imports the module fresh via vi.resetModules() to start with empty caches.
describe('fetchSignatureFont', () => {
  beforeEach(() => {
    vi.resetModules();
    // vi.stubEnv is reversed by vi.unstubAllEnvs in afterEach so we don't leak
    // env state into unrelated tests in the same Vitest worker.
    vi.stubEnv('NEXT_PRIVATE_INTERNAL_WEBAPP_URL', 'http://internal.test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches the font once and caches subsequent calls', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([0x42, 0x42, 0x42]), { status: 200 }));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchSignatureFont } = await import('./font-selection');

    const a = await fetchSignatureFont('caveat');
    const b = await fetchSignatureFont('caveat');

    expect(a.byteLength).toBe(3);
    expect(b.byteLength).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('http://internal.test/fonts/caveat.ttf');
  });

  it('dedupes concurrent calls onto a single in-flight fetch', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchSignatureFont } = await import('./font-selection');

    const [a, b, c] = await Promise.all([
      fetchSignatureFont('noto-sans'),
      fetchSignatureFont('noto-sans'),
      fetchSignatureFont('noto-sans'),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws AppError with descriptive message on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));

    vi.stubGlobal('fetch', mockFetch);

    // Both modules must come from the freshly-reset module graph - the static
    // AppError class identity differs from the dynamic one after resetModules.
    const { fetchSignatureFont } = await import('./font-selection');
    const { AppError } = await import('../../errors/app-error');

    const promise = fetchSignatureFont('noto-sans-chinese');

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toThrow(
      /Failed to fetch signature font "noto-sans-chinese" \(status: 404, url: http:\/\/internal\.test\/fonts\/noto-sans-chinese\.ttf\)/,
    );
  });

  it('evicts the cache entry on failure so subsequent calls retry', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([7, 7, 7]), { status: 200 }));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchSignatureFont } = await import('./font-selection');

    await expect(fetchSignatureFont('noto-sans-japanese')).rejects.toThrow();

    const bytes = await fetchSignatureFont('noto-sans-japanese');

    expect(bytes.byteLength).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('embedSignatureFont', () => {
  // Mock just the embedFont method we need. Each call returns a unique Symbol
  // so callers can compare references to verify cache hits and misses without
  // exercising real pdf-lib internals (already covered by pdf-lib's own tests).
  const createMockPdf = () => {
    // Each invocation returns a unique Symbol so callers can distinguish cache
    // hits (same reference) from cache misses (different references).
    // eslint-disable-next-line @typescript-eslint/require-await
    const embedFont = vi.fn(async () => Symbol('embed-result'));

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return { embedFont } as unknown as PDFDocument;
  };

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PRIVATE_INTERNAL_WEBAPP_URL', 'http://internal.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('embeds once per (document, fontKey) and returns the same PDFFont reference', async () => {
    const { embedSignatureFont } = await import('./font-selection');
    const pdf = createMockPdf();

    const a = await embedSignatureFont(pdf, 'caveat');
    const b = await embedSignatureFont(pdf, 'caveat');

    expect(a).toBe(b);
    expect(pdf.embedFont).toHaveBeenCalledTimes(1);
  });

  it('keys the cache separately for different options (calt-off vs default)', async () => {
    const { embedSignatureFont } = await import('./font-selection');
    const pdf = createMockPdf();

    const calted = await embedSignatureFont(pdf, 'caveat', { features: { calt: false } });
    const defaulted = await embedSignatureFont(pdf, 'caveat');

    expect(calted).not.toBe(defaulted);
    expect(pdf.embedFont).toHaveBeenCalledTimes(2);
  });

  it('uses separate caches per PDFDocument', async () => {
    const { embedSignatureFont } = await import('./font-selection');
    const pdfA = createMockPdf();
    const pdfB = createMockPdf();

    const fontA = await embedSignatureFont(pdfA, 'noto-sans');
    const fontB = await embedSignatureFont(pdfB, 'noto-sans');

    expect(fontA).not.toBe(fontB);
    expect(pdfA.embedFont).toHaveBeenCalledTimes(1);
    expect(pdfB.embedFont).toHaveBeenCalledTimes(1);
  });

  it('evicts the cache entry on embed failure so subsequent calls retry', async () => {
    const { embedSignatureFont } = await import('./font-selection');
    const pdf = createMockPdf();

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const embedMock = pdf.embedFont as unknown as ReturnType<typeof vi.fn>;
    embedMock.mockReset();
    embedMock
      .mockRejectedValueOnce(new Error('embed failed'))
      .mockResolvedValueOnce(Symbol('embed-result'));

    await expect(embedSignatureFont(pdf, 'noto-sans')).rejects.toThrow('embed failed');

    const font = await embedSignatureFont(pdf, 'noto-sans');

    expect(font).toBeDefined();
    expect(pdf.embedFont).toHaveBeenCalledTimes(2);
  });
});
