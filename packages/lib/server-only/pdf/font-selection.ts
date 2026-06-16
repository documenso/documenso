import type { PDFDocument, PDFFont } from '@cantoo/pdf-lib';

import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { logger } from '../../utils/logger';

// Time budget for fetching a bundled font over the internal webapp URL.
// Internal-network roundtrip should be milliseconds; 10s is comfortably
// above that and below any reasonable seal-document job timeout, so a
// hung request aborts cleanly instead of pinning a rejected-Promise cache
// entry and blocking every subsequent caller.
const FONT_FETCH_TIMEOUT_MS = 10_000;

/**
 * The bundled PDF text fonts and the public-asset filename each one resolves
 * to. Within this module this map is the single source of truth: `PdfFontKey`
 * is derived from its keys, so adding/removing/renaming a font is a one-line
 * edit here that fails at compile time everywhere else in the file. `as const`
 * is required for the `keyof typeof` to narrow to the string-literal union.
 *
 * Outside this module the same fontKey/filename/family-name information is
 * restated in several other shapes (each consumer wants a different shape, and
 * we don't currently have an automated way to derive them all from one place).
 * Adding, removing, or renaming a font therefore still requires manual updates
 * in every location listed below:
 *
 *   1. apps/remix/public/fonts/<filename>.ttf
 *        - the asset the fetch below resolves against
 *          NEXT_PRIVATE_INTERNAL_WEBAPP_URL.
 *   2. apps/remix/app/app.css
 *        - the `@font-face { font-family: ...; src: url(/fonts/<filename>.ttf) }`
 *          declaration that the browser and Konva paths consume.
 *   3. packages/lib/server-only/pdf/helpers.ts
 *        - the `FontLibrary.use(<family>, [...])` registration for skia-canvas.
 *   4. packages/lib/constants/pdf.ts (SIGNATURE_FONT_FAMILY)
 *        - the CSS family fallback chain used by Konva/skia-canvas; family
 *          names must match the @font-face / FontLibrary.use names, NOT the
 *          TTF's internal name table (e.g. Noto CJK files advertise as
 *          "Noto Sans JP/KR/SC" but are registered under longer names).
 *   5. FONT_FILE_MAP below itself.
 */
const FONT_FILE_MAP = {
  caveat: 'caveat.ttf',
  'noto-sans': 'noto-sans.ttf',
  'noto-sans-japanese': 'noto-sans-japanese.ttf',
  'noto-sans-chinese': 'noto-sans-chinese.ttf',
  'noto-sans-korean': 'noto-sans-korean.ttf',
} as const;

/**
 * Script category used to pick the right PDF text font in the pdf-lib path
 * (which only supports a single font per `drawText` call). The string-literal
 * union is derived from FONT_FILE_MAP so adding a font is a one-line edit
 * there.
 *
 * 'caveat' is the handwriting font for Latin and Cyrillic; the four 'noto-sans*'
 * variants cover scripts Caveat does not (Greek, Hebrew, Arabic, Indic, Thai,
 * CJK, Japanese kana, Korean Hangul, etc.).
 */
export type PdfFontKey = keyof typeof FONT_FILE_MAP;

// Korean (Hangul) - covers Hangul Syllables, Hangul Jamo, and Hangul Compatibility Jamo.
const KOREAN_REGEX = /\p{Script=Hangul}/u;

// Japanese kana - Hiragana + Katakana. CJK ideographs (used in Japanese too) are
// handled by the chinese fallback below, so this deliberately only checks for kana.
const JAPANESE_REGEX = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

// Han ideographs (shared across Chinese, Japanese kanji, Korean hanja). We map
// these to the Chinese Noto variant by default - see the SIGNATURE_FONT_FAMILY
// constant for the matching CSS fallback order in Konva paths.
const CJK_REGEX = /\p{Script=Han}/u;

// Heuristic match for "this character is likely outside Caveat's coverage".
// The handwriting font covers Latin (basic + extended) and Cyrillic;
// punctuation, whitespace, and digits are mostly Script=Common (shared across
// all scripts) or Script=Inherited (combining marks), and we treat the whole
// Common/Inherited set as Caveat-compatible. Anything outside Latin / Cyrillic
// / Common / Inherited - Greek, Hebrew, Arabic, Indic, Thai, Ethiopic, Khmer,
// Mongolian, etc. - forces a Noto Sans fallback.
//
// This is a heuristic, not a precise per-glyph coverage test: Script=Common
// also contains a long tail of symbols and pictographs (incl. emoji) that
// Caveat does not have, so inputs like "John 😀" would still render the
// pictograph as tofu under Caveat. We don't ship a Noto Emoji file in this
// repo, so routing those to noto-sans wouldn't actually fix the rendering
// either (and would strip the handwriting style from the Latin parts).
// Symbol/emoji coverage is intentionally out of scope here and would need a
// separate emoji font in the asset set.
//
// The regex is a negative character class against the Caveat-compatible set
// rather than an enumerated list of "known" non-Caveat scripts, so unlisted
// scripts (Ethiopic, Khmer, Mongolian, etc.) never silently fall through to
// Caveat. CJK ideographs and Japanese kana / Korean Hangul are matched by the
// more specific regexes above and routed before this check.
const CAVEAT_INCOMPATIBLE_REGEX = /[^\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]/u;

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

  if (CAVEAT_INCOMPATIBLE_REGEX.test(text)) {
    return 'noto-sans';
  }

  return 'caveat';
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
  // Build the URL via the WHATWG URL API rather than string interpolation so a
  // trailing slash on NEXT_PRIVATE_INTERNAL_WEBAPP_URL doesn't produce a
  // double-slash and so reserved characters in the (statically-known) file
  // name are still encoded correctly.
  const fontUrl = new URL(`/fonts/${fileName}`, NEXT_PRIVATE_INTERNAL_WEBAPP_URL()).toString();

  // Deliberately exclude the full fetch URL from the public AppError messages
  // below so internal hostnames/topology don't leak if the error propagates
  // to a client-visible surface. The file name is enough to identify which
  // font is missing; the full URL is available in server-side request logs.

  // AbortController gives the fetch a hard time budget. Without it a hung
  // connection would pin a never-resolving Promise in fontCache and block
  // every subsequent caller; on abort the catch below evicts the cache via
  // the wrapper in fetchPdfFontBytes.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FONT_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(fontUrl, { signal: controller.signal });

    if (!res.ok) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: `Failed to fetch bundled PDF font "${fontKey}" (file: ${fileName}, status: ${res.status})`,
      });
    }

    return await res.arrayBuffer();
  } catch (err) {
    // Re-throw our own AppError untouched so the non-OK branch above keeps
    // its specific status message.
    if (err instanceof AppError) {
      throw err;
    }

    // Network-level failure (DNS, TCP, timeout/abort, CORS, etc.) - fetch
    // threw before producing a usable Response. Log the underlying error
    // through the project logger for diagnostics (some fetch implementations
    // include the resolved URL or host in `err.message`, which we don't want
    // in the public AppError) and throw the same AppError shape callers get
    // for non-OK HTTP responses.
    logger.error({ fontKey, fileName, err }, '[font-selection] network failure fetching bundled font');

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Failed to fetch bundled PDF font "${fontKey}" (file: ${fileName}, network error)`,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Clear the process-level bundled-font byte cache. Intended for operational
 * tooling or tests that need to force a re-fetch (e.g. after the deployed
 * fonts are updated without a process restart, or to free memory in a
 * constrained environment between long-idle periods). Not used in the
 * normal production code path - sealing a document never needs to call
 * this. The per-document embed cache is GC'd alongside the PDFDocument
 * and doesn't need explicit clearing.
 */
export const resetPdfFontBytesCache = (): void => {
  fontCache.clear();
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
