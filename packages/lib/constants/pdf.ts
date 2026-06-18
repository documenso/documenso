import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const DEFAULT_STANDARD_FONT_SIZE = 12;
export const DEFAULT_HANDWRITING_FONT_SIZE = 50;
export const DEFAULT_SIGNATURE_TEXT_FONT_SIZE = 18;

export const MIN_STANDARD_FONT_SIZE = 8;
export const MIN_HANDWRITING_FONT_SIZE = 20;

export const CAVEAT_FONT_PATH = () => `${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`;

const SIGNATURE_FONT_FAMILY_CAVEAT = 'Caveat';

// Chinese precedes Japanese: the Japanese Noto file also contains Han
// ideographs (kanji) with JP-specific glyph shapes; without this order, pure
// Chinese text would render with JP forms.
//
// Family names match the @font-face declarations in apps/remix/app/app.css
// and the FontLibrary.use(...) registrations in
// packages/lib/server-only/pdf/helpers.ts; they do NOT match the TTFs'
// internal name tables (the shipped Noto CJK files advertise as "Noto Sans
// JP/KR/SC").
const SIGNATURE_FONT_FAMILY_NOTO =
  '"Noto Sans", "Noto Sans Chinese", "Noto Sans Japanese", "Noto Sans Korean", sans-serif';

// Heuristic - not a precise coverage test. Script=Common also includes
// symbols / pictographs / emoji that Caveat can't actually render, so e.g.
// "John 😀" still .notdefs the emoji under Caveat. We don't ship an emoji
// font, so routing them to Noto wouldn't help.
const CAVEAT_INCOMPATIBLE_REGEX = /[^\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]/u;

// All-or-nothing: a signature is never split between handwriting and sans-serif.
export const getSignatureFontFamily = (typedSignatureText: string): string =>
  CAVEAT_INCOMPATIBLE_REGEX.test(typedSignatureText) ? SIGNATURE_FONT_FAMILY_NOTO : SIGNATURE_FONT_FAMILY_CAVEAT;

export const PDF_SIZE_A4_72PPI = {
  width: 595,
  height: 842,
};
