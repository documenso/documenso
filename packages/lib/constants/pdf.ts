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
 */
export const SIGNATURE_FONT_FAMILY =
  'Caveat, Noto Sans, Noto Sans Japanese, Noto Sans Chinese, Noto Sans Korean, sans-serif';

export const PDF_SIZE_A4_72PPI = {
  width: 595,
  height: 842,
};
