import { z } from 'zod';

/**
 * RFC 5322 compliant email regex.
 *
 * This is more permissive than Zod's built-in `.email()` validator which rejects
 * valid international characters (e.g. "Søren@gmail.com").
 *
 * Compiled once at module level to avoid re-compilation on every validation call.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~\u{0080}-\u{FFFF}-]+@[a-zA-Z0-9\u{0080}-\u{FFFF}](?:[a-zA-Z0-9\u{0080}-\u{FFFF}-]{0,61}[a-zA-Z0-9\u{0080}-\u{FFFF}])?(?:\.[a-zA-Z0-9\u{0080}-\u{FFFF}](?:[a-zA-Z0-9\u{0080}-\u{FFFF}-]{0,61}[a-zA-Z0-9\u{0080}-\u{FFFF}])?)*$/u;

const DEFAULT_EMAIL_MESSAGE = 'Invalid email address';

/**
 * Code point ranges for control and invisible/formatting characters that render
 * as empty or break the UI (e.g. NUL, zero-width spaces, bidi overrides, BOM).
 */
const INVALID_TEXT_CODE_POINT_RANGES: [number, number][] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x061c, 0x061c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
  [0xd800, 0xdfff],
];

/**
 * The same characters expressed as literal "\\uXXXX" text, which can be stored
 * verbatim (e.g. the 6 characters `\`, `u`, `0`, `0`, `0`, `0`) and still break
 * rendering downstream. This regex is pure ASCII so it is safe to inline.
 */
const INVALID_TEXT_ESCAPE_SEQUENCE_REGEX =
  /\\u(?:00[0-1][0-9a-f]|007f|00[89][0-9a-f]|00ad|034f|061c|180e|200[b-f]|202[8-e]|206[0-9a-f]|feff)/iu;

export const hasInvalidTextCharacters = (value: string) => {
  if (INVALID_TEXT_ESCAPE_SEQUENCE_REGEX.test(value)) {
    return true;
  }

  for (const char of value) {
    const codePoint = char.codePointAt(0);

    if (codePoint === undefined) {
      continue;
    }

    const isInvalid = INVALID_TEXT_CODE_POINT_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);

    if (isInvalid) {
      return true;
    }
  }

  return false;
};

/**
 * Creates a Zod email schema using an RFC 5322 compliant regex.
 *
 * Supports international characters in the local part and domain
 * (e.g. "Søren@gmail.com", "user@dömain.com").
 *
 * Returns a standard `ZodString` so all string methods are chainable:
 * `.min()`, `.max()`, `.trim()`, `.toLowerCase()`, `.optional()`, `.nullish()`, etc.
 *
 * @example
 * ```ts
 * zEmail()
 * zEmail().min(1).max(254)
 * zEmail().trim().toLowerCase()
 * zEmail('Email is invalid')
 * zEmail({ message: 'Email is invalid' })
 * ```
 */
export const zEmail = (options?: string | { message?: string }) => {
  const message = typeof options === 'string' ? options : (options?.message ?? DEFAULT_EMAIL_MESSAGE);

  return z.string().regex(EMAIL_REGEX, { message });
};
