import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const DEFAULT_STANDARD_FONT_SIZE = 12;
export const DEFAULT_HANDWRITING_FONT_SIZE = 50;
export const DEFAULT_SIGNATURE_TEXT_FONT_SIZE = 18;

export const MIN_STANDARD_FONT_SIZE = 8;
export const MIN_HANDWRITING_FONT_SIZE = 20;

export const CAVEAT_FONT_PATH = () => `${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`;

/**
 * Font family string for typed signatures that includes proper fallbacks
 * for non-Latin scripts (Greek, Cyrillic, CJK, Korean, Japanese).
 *
 * Used by Konva/skia-canvas rendering paths (V2, certificate).
 *
 * Order matters: Noto Sans Chinese is listed before Noto Sans Japanese because
 * the Japanese font also contains Han ideographs (for kanji). Without this
 * ordering, pure Chinese text would resolve to the Japanese variant and render
 * with JP-specific glyph shapes, diverging from getSignatureFontKey (which
 * maps Han → 'noto-sans-chinese' in the pdf-lib path). Japanese kana and
 * Korean Hangul are not in the Chinese font, so the fallback chain correctly
 * continues past it for those scripts.
 */
export const SIGNATURE_FONT_FAMILY =
  'Caveat, Noto Sans, Noto Sans Chinese, Noto Sans Japanese, Noto Sans Korean, sans-serif';

export const PDF_SIZE_A4_72PPI = {
  width: 595,
  height: 842,
};
