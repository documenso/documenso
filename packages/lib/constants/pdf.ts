import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const DEFAULT_STANDARD_FONT_SIZE = 12;
export const DEFAULT_HANDWRITING_FONT_SIZE = 50;
export const DEFAULT_SIGNATURE_TEXT_FONT_SIZE = 18;

export const MIN_STANDARD_FONT_SIZE = 8;
export const MIN_HANDWRITING_FONT_SIZE = 20;

export const CAVEAT_FONT_PATH = () => `${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`;

/**
 * Caveat handwriting family - used when every character in the typed signature
 * is Caveat-coverable (Latin + Cyrillic + Script=Common for punctuation /
 * whitespace / digits + Script=Inherited for combining marks).
 */
const SIGNATURE_FONT_FAMILY_CAVEAT = 'Caveat';

/**
 * Noto Sans fallback chain - used when the typed signature contains any
 * character Caveat doesn't cover (Greek, Hebrew, Arabic, Indic, Thai, CJK,
 * Japanese kana, Korean Hangul, etc.). The whole signature renders in this
 * chain; we deliberately never mix Caveat with Noto in the same signature.
 *
 * The Konva / skia-canvas paths walk the chain per-character, so listing all
 * four Noto Sans variants lets a single string handle every script we ship a
 * font for. Order matters: Noto Sans Chinese is listed before Noto Sans
 * Japanese because the Japanese font also contains Han ideographs (kanji) with
 * JP-specific glyph shapes - without this ordering, pure Chinese text would
 * resolve to the Japanese variant.
 *
 * Family names here match the `@font-face` declarations in
 * `apps/remix/app/app.css` and the `FontLibrary.use(...)` registrations in
 * `packages/lib/server-only/pdf/helpers.ts`; they do NOT necessarily match
 * the TTFs' internal name tables (the shipped Noto CJK files advertise as
 * "Noto Sans JP/KR/SC"). Multi-word family names are quoted for cross-parser
 * consistency. Updating the TTFs or `@font-face` names requires updating this
 * string too.
 */
const SIGNATURE_FONT_FAMILY_NOTO =
  '"Noto Sans", "Noto Sans Chinese", "Noto Sans Japanese", "Noto Sans Korean", sans-serif';

/**
 * Negative-match heuristic: matches any character that Caveat is unlikely to
 * render. The "Caveat-coverable" set is Latin + Cyrillic + Script=Common +
 * Script=Inherited; anything else forces the Noto fallback.
 *
 * This is intentionally a heuristic: Script=Common also contains a long tail
 * of symbols / pictographs / emoji that Caveat doesn't actually cover, so
 * inputs like "John 😀" still render the pictograph as `.notdef` under
 * Caveat. We don't ship an emoji font, so routing them to Noto wouldn't fix
 * the rendering and would strip the handwriting style from the Latin parts.
 * Emoji coverage is intentionally out of scope.
 */
const CAVEAT_INCOMPATIBLE_REGEX = /[^\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]/u;

/**
 * Pick the font family string for a typed signature.
 *
 * Caveat handwriting if every character is Caveat-coverable, otherwise the
 * full Noto Sans fallback chain. Deliberately all-or-nothing so a single
 * signature is never split between handwriting and sans-serif.
 *
 * Used by the Konva / skia-canvas paths (V2 field insertion and the signing
 * certificate). The pdf-lib V1 path is unchanged in this PR and still uses
 * Caveat unconditionally for signatures.
 */
export const getSignatureFontFamily = (typedSignatureText: string): string =>
  CAVEAT_INCOMPATIBLE_REGEX.test(typedSignatureText) ? SIGNATURE_FONT_FAMILY_NOTO : SIGNATURE_FONT_FAMILY_CAVEAT;

export const PDF_SIZE_A4_72PPI = {
  width: 595,
  height: 842,
};
