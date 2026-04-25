import type { EmbedFontOptions, PDFDocument, PDFFont } from '@cantoo/pdf-lib';

import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';

/**
 * Detect the script category of a text string to select the appropriate font
 * for PDF rendering with pdf-lib (which only supports a single font per drawText call).
 *
 * Returns the font key to use: 'caveat' for Latin-only text, or the appropriate
 * Noto Sans variant for non-Latin scripts.
 */
export type SignatureFontKey =
  | 'caveat'
  | 'noto-sans'
  | 'noto-sans-japanese'
  | 'noto-sans-chinese'
  | 'noto-sans-korean';

// Korean (Hangul) - covers Hangul Syllables, Hangul Jamo, and Hangul Compatibility Jamo.
const KOREAN_REGEX = /\p{Script=Hangul}/u;

// Japanese kana - Hiragana + Katakana. CJK ideographs (used in Japanese too) are
// handled by the chinese fallback below, so this deliberately only checks for kana.
const JAPANESE_REGEX = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

// Han ideographs (shared across Chinese, Japanese kanji, Korean hanja). We map
// these to the Chinese Noto variant by default - see the SIGNATURE_FONT_FAMILY
// constant for the matching CSS fallback order in Konva paths.
const CJK_REGEX = /\p{Script=Han}/u;

// Scripts that Caveat does NOT support and need Noto Sans as a fallback.
// Caveat itself covers Latin (basic + extended) and Cyrillic, so Cyrillic is
// deliberately excluded here - keeping it routed to Caveat preserves the
// handwriting style for Russian/Bulgarian/Serbian/etc. names. CJK, Japanese
// kana, and Korean Hangul are matched by the more specific regexes above.
const NON_CAVEAT_SCRIPT_REGEX =
  /[\p{Script=Greek}\p{Script=Armenian}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Myanmar}\p{Script=Georgian}]/u;

/**
 * Determine which font to use for the given typed signature text.
 * Priority: Korean > Japanese > Chinese > Noto Sans (Greek/Cyrillic/etc.) > Caveat.
 *
 * Known limitation: pure-kanji Japanese names (e.g. "田中") match `CJK_REGEX`
 * because they contain no kana, and so resolve to the Chinese variant. Han
 * ideographs have visible CN/JP shape differences for some characters, so
 * Japanese signers using kanji-only names will see Chinese glyph forms. Without
 * additional context (recipient locale, browser language, etc.) Han alone is
 * ambiguous, and consistently mapping it to Chinese matches the Konva fallback
 * chain in `SIGNATURE_FONT_FAMILY`. A locale-aware override could improve this
 * if it ever becomes a noticeable problem.
 */
export const getSignatureFontKey = (text: string): SignatureFontKey => {
  if (KOREAN_REGEX.test(text)) {
    return 'noto-sans-korean';
  }

  if (JAPANESE_REGEX.test(text)) {
    return 'noto-sans-japanese';
  }

  if (CJK_REGEX.test(text)) {
    return 'noto-sans-chinese';
  }

  if (NON_CAVEAT_SCRIPT_REGEX.test(text)) {
    return 'noto-sans';
  }

  return 'caveat';
};

const FONT_FILE_MAP: Record<SignatureFontKey, string> = {
  caveat: 'caveat.ttf',
  'noto-sans': 'noto-sans.ttf',
  'noto-sans-japanese': 'noto-sans-japanese.ttf',
  'noto-sans-chinese': 'noto-sans-chinese.ttf',
  'noto-sans-korean': 'noto-sans-korean.ttf',
};

// Process-level cache so repeated signature insertions (one call per field) don't
// re-download multi-MB fonts. Storing the in-flight Promise also dedupes concurrent
// fetches; on failure the entry is evicted so the next call can retry.
const fontCache = new Map<SignatureFontKey, Promise<ArrayBuffer>>();

const fetchFontBytes = async (fontKey: SignatureFontKey): Promise<ArrayBuffer> => {
  const fileName = FONT_FILE_MAP[fontKey];
  const fontUrl = `${NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/fonts/${fileName}`;
  const res = await fetch(fontUrl);

  if (!res.ok) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Failed to fetch signature font "${fontKey}" (status: ${res.status}, url: ${fontUrl})`,
    });
  }

  return res.arrayBuffer();
};

/**
 * Fetch the font data (ArrayBuffer) for the given font key from the internal webapp URL.
 * Results are cached per process; failures are not cached.
 */
export const fetchSignatureFont = async (fontKey: SignatureFontKey): Promise<ArrayBuffer> => {
  const cached = fontCache.get(fontKey);

  if (cached) {
    return cached;
  }

  const promise = fetchFontBytes(fontKey).catch((err) => {
    fontCache.delete(fontKey);
    throw err;
  });

  fontCache.set(fontKey, promise);

  return promise;
};

// Per-document cache of embedded PDFFont instances. Without this, each call to
// insert-field-in-pdf (once per field) would re-parse and re-embed the same
// TTF bytes into the PDF, duplicating font streams - significant bloat with
// the multi-MB Noto CJK variants. The WeakMap lets GC reclaim the cache when
// the PDFDocument is discarded.
const embedCache = new WeakMap<PDFDocument, Map<string, Promise<PDFFont>>>();

// Cache key must distinguish the same font embedded with different pdf-lib
// options, since embed options affect the emitted glyph program. In practice
// only `features.calt` varies (Caveat disables contextual alternates).
const getEmbedCacheKey = (fontKey: SignatureFontKey, options?: EmbedFontOptions): string =>
  options?.features?.calt === false ? `${fontKey}:calt-off` : fontKey;

/**
 * Embed a signature font into the given PDFDocument, reusing a previously
 * embedded PDFFont if the same (document, fontKey, options) combination has
 * already been embedded. The caller must have already registered fontkit
 * on the document via `pdf.registerFontkit(fontkit)`.
 */
export const embedSignatureFont = async (
  pdf: PDFDocument,
  fontKey: SignatureFontKey,
  options?: EmbedFontOptions,
): Promise<PDFFont> => {
  const cacheKey = getEmbedCacheKey(fontKey, options);

  let perDocCache = embedCache.get(pdf);

  if (!perDocCache) {
    perDocCache = new Map();
    embedCache.set(pdf, perDocCache);
  }

  const cached = perDocCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const promise = fetchSignatureFont(fontKey).then(async (bytes) => pdf.embedFont(bytes, options));

  // Evict on failure so a subsequent call can retry.
  promise.catch(() => {
    perDocCache?.delete(cacheKey);
  });

  perDocCache.set(cacheKey, promise);

  return promise;
};
