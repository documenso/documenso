import type { PDFDocument, PDFFont } from '@cantoo/pdf-lib';

import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';

/**
 * Detect the script category of a text string to select the appropriate font
 * for PDF rendering with pdf-lib (which only supports a single font per drawText call).
 *
 * Returns 'caveat' for scripts the Caveat handwriting font can render
 * (Latin and Cyrillic), or the appropriate Noto Sans variant for scripts
 * Caveat does not cover (Greek, Hebrew, Arabic, Indic, Thai, CJK, Japanese
 * kana, Korean Hangul, etc.).
 */
export type PdfFontKey = 'caveat' | 'noto-sans' | 'noto-sans-japanese' | 'noto-sans-chinese' | 'noto-sans-korean';

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
 * Detection order:
 *   Korean (Hangul) > Japanese (kana) > Chinese (Han) >
 *   non-Caveat fallback (Greek/Hebrew/Arabic/Indic/etc.) > Caveat.
 * Caveat is the default and also covers Cyrillic, so Cyrillic-only text
 * (e.g. "Иванов") falls through to 'caveat' to preserve the handwriting
 * style. Mixed-script inputs that include any non-Caveat script (e.g.
 * Cyrillic + Greek) fall back to Noto Sans because Greek alone forces it.
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
export const getSignatureFontKey = (text: string): PdfFontKey => {
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

// The TTFs listed here MUST ship at apps/remix/public/fonts/<filename> in every
// deployment - the fetch below resolves against NEXT_PRIVATE_INTERNAL_WEBAPP_URL.
// The same files are also declared by `@font-face` rules in apps/remix/app/app.css
// and registered with skia-canvas via `FontLibrary.use(...)` in helpers.ts;
// the family names in SIGNATURE_FONT_FAMILY (constants/pdf.ts) are the names
// declared there, not the TTF's internal name table (which differs - e.g. the
// Noto CJK files advertise as "Noto Sans JP/KR/SC"). If a font is added/removed
// or renamed, update all three places to keep them in sync.
const FONT_FILE_MAP: Record<PdfFontKey, string> = {
  caveat: 'caveat.ttf',
  'noto-sans': 'noto-sans.ttf',
  'noto-sans-japanese': 'noto-sans-japanese.ttf',
  'noto-sans-chinese': 'noto-sans-chinese.ttf',
  'noto-sans-korean': 'noto-sans-korean.ttf',
};

// Process-level cache so repeated signature insertions (one call per field) don't
// re-download multi-MB fonts. Storing the in-flight Promise also dedupes concurrent
// fetches; on failure the entry is evicted so the next call can retry.
//
// Memory footprint is bounded by the PdfFontKey enum (5 entries max).
// Worst case ~30MB if all three Noto CJK variants get loaded (~10MB each);
// Caveat and Noto Sans regular together are <1MB. Once loaded, fonts stay in
// memory for the process lifetime — a process restart (or container recycle)
// is the only way to free them. For memory-constrained deployments this is
// still a clear win over re-fetching multi-MB fonts on every sealed PDF.
const fontCache = new Map<PdfFontKey, Promise<ArrayBuffer>>();

const fetchFontBytes = async (fontKey: PdfFontKey): Promise<ArrayBuffer> => {
  const fileName = FONT_FILE_MAP[fontKey];
  const fontUrl = `${NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/fonts/${fileName}`;

  // Deliberately exclude the full fetch URL from the public AppError messages
  // below so internal hostnames/topology don't leak if the error propagates
  // to a client-visible surface. The file name is enough to identify which
  // font is missing; the full URL is available in server-side request logs.
  let res: Response;

  try {
    res = await fetch(fontUrl);
  } catch (err) {
    // Network-level failure (DNS, TCP, timeout, CORS, etc.) — fetch throws
    // before producing a Response. Wrap so callers see the same AppError
    // shape they get for non-OK HTTP responses.
    const cause = err instanceof Error ? `: ${err.message}` : '';

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Failed to fetch bundled PDF font "${fontKey}" (file: ${fileName}, network error${cause})`,
    });
  }

  if (!res.ok) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Failed to fetch bundled PDF font "${fontKey}" (file: ${fileName}, status: ${res.status})`,
    });
  }

  return res.arrayBuffer();
};

/**
 * Fetch the bytes of one of the bundled PDF text fonts (Caveat / Noto Sans /
 * Noto Sans CJK / JP / KR) from the internal webapp URL. Used by
 * `embedPdfTextFont` for every text field type, not just typed signatures.
 *
 * Results are cached per process; failures are not cached.
 */
export const fetchPdfFontBytes = async (fontKey: PdfFontKey): Promise<ArrayBuffer> => {
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

/**
 * Embed options exposed by embedPdfTextFont. Deliberately narrower than
 * pdf-lib's full EmbedFontOptions so the cache key (which incorporates every
 * relevant flag) can never go out of sync with the options actually passed to
 * pdf-lib's embedFont. If new options become necessary, add a field here AND
 * include it in getEmbedCacheKey so two different option sets don't alias to
 * the same cached PDFFont.
 */
export type EmbedPdfTextFontOptions = {
  /**
   * Disable Caveat's contextual alternates (calt) so signed text doesn't
   * substitute connected-script glyphs at letter joins. Required when
   * embedding Caveat for signatures.
   */
  disableContextualAlternates?: boolean;
};

const getEmbedCacheKey = (fontKey: PdfFontKey, options?: EmbedPdfTextFontOptions): string =>
  options?.disableContextualAlternates ? `${fontKey}:calt-off` : fontKey;

/**
 * Embed one of the bundled signature fonts into the given PDFDocument and
 * return the resulting PDFFont. Caches results per (document, fontKey,
 * options) so repeated calls within the same PDF reuse a single embedded
 * font stream — important when sealing a document with many fields.
 *
 * Also used for non-signature text fields (Noto Sans for name / email /
 * date / text / checkbox / radio labels) since they share the same font
 * inventory. The caller must have already registered fontkit on the
 * document via `pdf.registerFontkit(fontkit)`.
 */
export const embedPdfTextFont = async (
  pdf: PDFDocument,
  fontKey: PdfFontKey,
  options?: EmbedPdfTextFontOptions,
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

  const pdfLibOptions = options?.disableContextualAlternates ? { features: { calt: false } } : undefined;

  const promise = fetchPdfFontBytes(fontKey).then(async (bytes) => pdf.embedFont(bytes, pdfLibOptions));

  // Evict on failure so a subsequent call can retry. The catch is purely a
  // side effect - rejection still propagates to awaiters of `promise`.
  void promise.catch(() => {
    perDocCache?.delete(cacheKey);
  });

  perDocCache.set(cacheKey, promise);

  return promise;
};

/**
 * Embed the right font for a typed signature based on the script of the text.
 * Picks Caveat (with contextual alternates disabled) for Latin/Cyrillic and
 * the matching Noto Sans variant for everything else. The decision lives here
 * so the policy stays consistent across any PDF insertion path that renders
 * typed signatures.
 *
 * Cached per (document, fontKey, options) via `embedPdfTextFont`, so repeated
 * calls for the same text/document return the same PDFFont reference. The
 * caller must have already registered fontkit on the document.
 */
export const embedTypedSignatureFont = async (pdf: PDFDocument, typedSignatureText: string): Promise<PDFFont> => {
  const fontKey = getSignatureFontKey(typedSignatureText);

  return fontKey === 'caveat'
    ? embedPdfTextFont(pdf, 'caveat', { disableContextualAlternates: true })
    : embedPdfTextFont(pdf, fontKey);
};
