import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const DEFAULT_STANDARD_FONT_SIZE = 12;
export const DEFAULT_HANDWRITING_FONT_SIZE = 50;
export const DEFAULT_SIGNATURE_TEXT_FONT_SIZE = 18;

export const MIN_STANDARD_FONT_SIZE = 8;
export const MIN_HANDWRITING_FONT_SIZE = 20;

export const CAVEAT_FONT_PATH = () => `${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`;

const SIGNATURE_FONT_FAMILY_CAVEAT = 'Caveat';

// Chinese precedes Japanese: the JP Noto file also carries Han ideographs
// with JP-specific glyph shapes, so pure-CN text would otherwise render
// with JP forms. Family names must stay in sync with the @font-face
// declarations in apps/remix/app/app.css and the FontLibrary.use(...)
// registrations in packages/lib/server-only/pdf/helpers.ts.
const SIGNATURE_FONT_FAMILY_NOTO =
  '"Noto Sans", "Noto Sans Chinese", "Noto Sans Japanese", "Noto Sans Korean", sans-serif';

const isASCII = (str: string) => /^\p{ASCII}*$/u.test(str);

// All-or-nothing on purpose: a signature is never split between handwriting and sans-serif.
export const getSignatureFontFamily = (typedSignatureText: string): string =>
  isASCII(typedSignatureText) ? SIGNATURE_FONT_FAMILY_CAVEAT : SIGNATURE_FONT_FAMILY_NOTO;

export const PDF_SIZE_A4_72PPI = {
  width: 595,
  height: 842,
};
