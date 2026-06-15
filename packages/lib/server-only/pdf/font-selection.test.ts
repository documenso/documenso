import type { PDFDocument } from '@cantoo/pdf-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The rest of this file uses `vi.resetModules()` + dynamic `await import(...)`
// so each describe block starts with empty module-level caches in
// `font-selection.ts`. The `getSignatureFontKey` suite below follows the same
// pattern even though the function is pure today, so the whole file uses one
// module-loading strategy and a future module-scope state addition can't
// silently introduce cross-suite coupling.
describe('getSignatureFontKey', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return caveat for Latin-only text', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('John Doe')).toBe('caveat');
    expect(getSignatureFontKey('Jane Smith')).toBe('caveat');
    expect(getSignatureFontKey('')).toBe('caveat');
  });

  it('should return noto-sans for Greek characters', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('Ελληνικά')).toBe('noto-sans');
    expect(getSignatureFontKey('αβγδ')).toBe('noto-sans');
    expect(getSignatureFontKey('Ωmega')).toBe('noto-sans');
  });

  it('should return caveat for Cyrillic characters (Caveat covers Cyrillic)', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('Кириллица')).toBe('caveat');
    expect(getSignatureFontKey('Иванов')).toBe('caveat');
  });

  it('should return noto-sans when Cyrillic is mixed with another non-Caveat script', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    // Greek wins because Caveat cannot render it, so the whole signature
    // must fall back to a font that covers both.
    expect(getSignatureFontKey('Иван Ωmega')).toBe('noto-sans');
  });

  it('should return noto-sans for Arabic characters', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('عربي')).toBe('noto-sans');
  });

  it('should return noto-sans for scripts not explicitly enumerated', async () => {
    // Regression: an earlier shape enumerated specific non-Caveat scripts and
    // silently defaulted unknown ones to Caveat, which would render as tofu.
    // The current shape inverts the test (Caveat only when chars are
    // Latin/Cyrillic/Common/Inherited), so any unlisted script lands on
    // noto-sans.
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('ሰላም')).toBe('noto-sans'); // Ethiopic
    expect(getSignatureFontKey('សួស្ដី')).toBe('noto-sans'); // Khmer
    expect(getSignatureFontKey('ᠮᠣᠩᠭᠣᠯ')).toBe('noto-sans'); // Mongolian
  });

  it('should return noto-sans-korean for Korean characters', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('도큐멘소')).toBe('noto-sans-korean');
    expect(getSignatureFontKey('한글')).toBe('noto-sans-korean');
  });

  it('should return noto-sans-japanese for Japanese characters', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('こんにちは')).toBe('noto-sans-japanese');
    expect(getSignatureFontKey('カタカナ')).toBe('noto-sans-japanese');
  });

  it('should return noto-sans-chinese for Chinese characters', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('中文签名')).toBe('noto-sans-chinese');
    expect(getSignatureFontKey('签署')).toBe('noto-sans-chinese');
  });

  it('should prioritize Korean over CJK for mixed text', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('한글中文')).toBe('noto-sans-korean');
  });

  it('should prioritize Japanese over CJK for mixed text', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('ひらがな中文')).toBe('noto-sans-japanese');
  });

  it('should handle Latin + non-Latin mixed text', async () => {
    const { getSignatureFontKey } = await import('./font-selection');

    expect(getSignatureFontKey('Hello 안녕')).toBe('noto-sans-korean');
    expect(getSignatureFontKey('Sign Ελληνικά')).toBe('noto-sans');
    expect(getSignatureFontKey('Name 中文')).toBe('noto-sans-chinese');
  });
});

// fetchPdfFontBytes and embedPdfTextFont hold module-level caches, so each
// test imports the module fresh via vi.resetModules() to start with empty caches.
// Tests mock `fetch` to return a minimal fetch-like object (the shape
// fetchPdfFontBytes actually depends on) instead of constructing
// `new Response(...)`, so they don't require the global Response constructor
// to be present in the test runtime.
const mockFetchResponse = (bytes: Uint8Array, status: number) => ({
  ok: status >= 200 && status < 300,
  status,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

describe('fetchPdfFontBytes', () => {
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
    const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse(new Uint8Array([0x42, 0x42, 0x42]), 200));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchPdfFontBytes } = await import('./font-selection');

    const a = await fetchPdfFontBytes('caveat');
    const b = await fetchPdfFontBytes('caveat');

    expect(a.byteLength).toBe(3);
    expect(b.byteLength).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // fetch is called with the URL plus a `{ signal }` init for the abort
    // timeout - assert against the URL specifically.
    expect(mockFetch).toHaveBeenCalledWith('http://internal.test/fonts/caveat.ttf', expect.anything());
  });

  it('dedupes concurrent calls onto a single in-flight fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse(new Uint8Array([1, 2, 3]), 200));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchPdfFontBytes } = await import('./font-selection');

    const [a, b, c] = await Promise.all([
      fetchPdfFontBytes('noto-sans'),
      fetchPdfFontBytes('noto-sans'),
      fetchPdfFontBytes('noto-sans'),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws AppError with descriptive message on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse(new Uint8Array(0), 404));

    vi.stubGlobal('fetch', mockFetch);

    // Both modules must come from the freshly-reset module graph - the static
    // AppError class identity differs from the dynamic one after resetModules.
    const { fetchPdfFontBytes } = await import('./font-selection');
    const { AppError } = await import('../../errors/app-error');

    const promise = fetchPdfFontBytes('noto-sans-chinese');

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toThrow(
      /Failed to fetch bundled PDF font "noto-sans-chinese" \(file: noto-sans-chinese\.ttf, status: 404\)/,
    );
  });

  it('throws AppError when fetch itself rejects (network / DNS / timeout)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchPdfFontBytes } = await import('./font-selection');
    const { AppError } = await import('../../errors/app-error');
    const { logger } = await import('../../utils/logger');

    // Suppress the project logger output while still asserting it was called.
    const logErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);

    const promise = fetchPdfFontBytes('noto-sans-korean');

    await expect(promise).rejects.toBeInstanceOf(AppError);
    // Message must NOT include the underlying err.message (which could
    // include resolved URLs/hostnames in some fetch implementations).
    await expect(promise).rejects.toThrow(
      /Failed to fetch bundled PDF font "noto-sans-korean" \(file: noto-sans-korean\.ttf, network error\)$/,
    );
    expect(logErrorSpy).toHaveBeenCalled();
  });

  it('passes an AbortSignal to fetch so a hung request can be cancelled', async () => {
    // Verify the SUT wires up an AbortSignal on every fetch. The fact that
    // the signal eventually fires (via setTimeout) is straightforward setTimeout
    // + AbortController plumbing - not worth a fake-timers test that risks
    // unhandled rejections; the contract that matters is "fetch receives a
    // signal" so it CAN be aborted.
    const mockFetch = vi.fn().mockResolvedValue(mockFetchResponse(new Uint8Array([1]), 200));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchPdfFontBytes } = await import('./font-selection');

    await fetchPdfFontBytes('caveat');

    // Shape check (not `instanceof AbortSignal`) keeps the test portable across
    // runtimes where the AbortSignal global may not be present or may diverge
    // from the spec - we only care that fetch received something with an
    // `aborted` boolean it can read.
    const init = mockFetch.mock.calls[0][1] as { signal?: { aborted: boolean } } | undefined;
    expect(typeof init?.signal?.aborted).toBe('boolean');
    expect(init?.signal?.aborted).toBe(false);
  });

  it('resetPdfFontBytesCache forces a fresh fetch on the next call', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchResponse(new Uint8Array([1]), 200))
      .mockResolvedValueOnce(mockFetchResponse(new Uint8Array([2]), 200));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchPdfFontBytes, resetPdfFontBytesCache } = await import('./font-selection');

    await fetchPdfFontBytes('caveat');
    await fetchPdfFontBytes('caveat');

    expect(mockFetch).toHaveBeenCalledTimes(1);

    resetPdfFontBytesCache();

    await fetchPdfFontBytes('caveat');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('evicts the cache entry on failure so subsequent calls retry', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(mockFetchResponse(new Uint8Array(0), 503))
      .mockResolvedValueOnce(mockFetchResponse(new Uint8Array([7, 7, 7]), 200));

    vi.stubGlobal('fetch', mockFetch);

    const { fetchPdfFontBytes } = await import('./font-selection');

    await expect(fetchPdfFontBytes('noto-sans-japanese')).rejects.toThrow();

    const bytes = await fetchPdfFontBytes('noto-sans-japanese');

    expect(bytes.byteLength).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('embedPdfTextFont', () => {
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(new Uint8Array([1, 2, 3]), 200)));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('embeds once per (document, fontKey) and returns the same PDFFont reference', async () => {
    const { embedPdfTextFont } = await import('./font-selection');
    const pdf = createMockPdf();

    const a = await embedPdfTextFont(pdf, 'caveat');
    const b = await embedPdfTextFont(pdf, 'caveat');

    expect(a).toBe(b);
    expect(pdf.embedFont).toHaveBeenCalledTimes(1);
  });

  it('keys the cache separately for different options (calt-off vs default)', async () => {
    const { embedPdfTextFont } = await import('./font-selection');
    const pdf = createMockPdf();

    const calted = await embedPdfTextFont(pdf, 'caveat', { disableContextualAlternates: true });
    const defaulted = await embedPdfTextFont(pdf, 'caveat');

    expect(calted).not.toBe(defaulted);
    expect(pdf.embedFont).toHaveBeenCalledTimes(2);
  });

  it('uses separate caches per PDFDocument', async () => {
    const { embedPdfTextFont } = await import('./font-selection');
    const pdfA = createMockPdf();
    const pdfB = createMockPdf();

    const fontA = await embedPdfTextFont(pdfA, 'noto-sans');
    const fontB = await embedPdfTextFont(pdfB, 'noto-sans');

    expect(fontA).not.toBe(fontB);
    expect(pdfA.embedFont).toHaveBeenCalledTimes(1);
    expect(pdfB.embedFont).toHaveBeenCalledTimes(1);
  });

  it('evicts the cache entry on embed failure so subsequent calls retry', async () => {
    const { embedPdfTextFont } = await import('./font-selection');
    const pdf = createMockPdf();

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const embedMock = pdf.embedFont as unknown as ReturnType<typeof vi.fn>;
    embedMock.mockReset();
    embedMock.mockRejectedValueOnce(new Error('embed failed')).mockResolvedValueOnce(Symbol('embed-result'));

    await expect(embedPdfTextFont(pdf, 'noto-sans')).rejects.toThrow('embed failed');

    const font = await embedPdfTextFont(pdf, 'noto-sans');

    expect(font).toBeDefined();
    expect(pdf.embedFont).toHaveBeenCalledTimes(2);
  });
});

describe('embedTypedSignatureFont', () => {
  const createMockPdf = () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const embedFont = vi.fn(async () => Symbol('embed-result'));

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return { embedFont } as unknown as PDFDocument;
  };

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PRIVATE_INTERNAL_WEBAPP_URL', 'http://internal.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(new Uint8Array([1, 2, 3]), 200)));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('embeds Caveat with contextual alternates disabled for Latin text', async () => {
    const { embedTypedSignatureFont } = await import('./font-selection');
    const pdf = createMockPdf();

    await embedTypedSignatureFont(pdf, 'John Doe');

    expect(pdf.embedFont).toHaveBeenCalledTimes(1);
    expect(pdf.embedFont).toHaveBeenCalledWith(expect.anything(), { features: { calt: false } });
  });

  it('embeds Caveat for Cyrillic text (Caveat covers Cyrillic)', async () => {
    const { embedTypedSignatureFont } = await import('./font-selection');
    const pdf = createMockPdf();

    await embedTypedSignatureFont(pdf, 'Иванов');

    expect(pdf.embedFont).toHaveBeenCalledWith(expect.anything(), { features: { calt: false } });
  });

  it('embeds the Noto Sans variant without calt-off for non-Caveat scripts', async () => {
    const { embedTypedSignatureFont } = await import('./font-selection');
    const pdf = createMockPdf();

    await embedTypedSignatureFont(pdf, '도큐멘소');

    expect(pdf.embedFont).toHaveBeenCalledWith(expect.anything(), undefined);
  });
});
