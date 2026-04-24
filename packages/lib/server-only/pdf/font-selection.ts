import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';

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

// CJK ideographs - primarily Chinese, also used in Japanese kanji and Korean hanja.
const CJK_REGEX = /\p{Script=Han}/u;

// Other common non-Latin scripts Caveat cannot render but Noto Sans can.
const NON_LATIN_SCRIPT_REGEX =
  /[\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Myanmar}\p{Script=Georgian}]/u;

/**
 * Determine which font to use for the given typed signature text.
 * Priority: Korean > Japanese > Chinese > Noto Sans (Greek/Cyrillic/etc.) > Caveat.
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

  if (NON_LATIN_SCRIPT_REGEX.test(text)) {
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

/**
 * Fetch the font data (ArrayBuffer) for the given font key from the internal webapp URL.
 */
export const fetchSignatureFont = async (fontKey: SignatureFontKey): Promise<ArrayBuffer> => {
  const fileName = FONT_FILE_MAP[fontKey];
  const res = await fetch(`${NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/fonts/${fileName}`);

  return res.arrayBuffer();
};
