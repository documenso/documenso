import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const DEFAULT_STANDARD_FONT_SIZE = 12;
export const DEFAULT_HANDWRITING_FONT_SIZE = 50;
export const DEFAULT_SIGNATURE_TEXT_FONT_SIZE = 18;

export const MIN_STANDARD_FONT_SIZE = 8;
export const MIN_HANDWRITING_FONT_SIZE = 20;

export const CAVEAT_FONT_PATH = () => `${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`;

/**
 * Font family string for typed signatures used by the Konva/skia-canvas
 * rendering paths (V2 field insertion, signing certificate).
 *
 * Per-family coverage:
 *   - "Caveat"            handwriting font for Latin and Cyrillic
 *   - "Noto Sans"         Greek, Hebrew, Arabic, Indic, Thai, Lao, etc.
 *   - "Noto Sans Chinese" Han ideographs
 *   - "Noto Sans Japanese" Hiragana, Katakana
 *   - "Noto Sans Korean"  Hangul
 *
 * The family names here are the ones declared by `@font-face` rules in
 * `apps/remix/app/app.css` and registered with skia-canvas via
 * `FontLibrary.use(...)` in `packages/lib/server-only/pdf/helpers.ts`.
 * They do NOT necessarily match the TTF's internal name table - the shipped
 * Noto CJK files advertise themselves as "Noto Sans JP/KR/SC" but are
 * registered under the longer names below so the fallback chain resolves
 * cleanly. Updating the TTFs (or renaming the @font-face declarations)
 * requires updating this string too.
 *
 * Multi-word family names are wrapped in double quotes for clarity and
 * cross-parser consistency. The CSS Fonts spec actually permits unquoted
 * multi-word identifiers (`Noto Sans` parses as a single family), but
 * quoting makes the family boundaries unambiguous at a glance and avoids
 * surprises in non-CSS consumers that may interpret the same string (e.g.
 * PDF appearance streams or other downstream tooling).
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
  'Caveat, "Noto Sans", "Noto Sans Chinese", "Noto Sans Japanese", "Noto Sans Korean", sans-serif';

export const PDF_SIZE_A4_72PPI = {
  width: 595,
  height: 842,
};
