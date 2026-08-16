import { z } from 'zod';

export const URL_PATTERN = /https?:\/\/|www\./i;

/**
 * Characters that render as empty/invisible or break text layout:
 *
 * - `\p{C}`         - control, format, lone surrogate, private use and
 *                     unassigned code points (NUL, zero-width spaces, bidi
 *                     overrides, BOM, tag characters, noncharacters).
 * - `\p{Zl}\p{Zp}`  - line and paragraph separators.
 * - `\u{034F}`      - combining grapheme joiner (invisible). Kept outside the
 *                     character class because it is a combining mark, which
 *                     lint rules reject inside classes.
 * - remaining       - letters that render as blank (Hangul fillers, braille blank).
 *
 * The `\p{...}` classes are maintained by the Unicode database, so newly
 * assigned characters in these categories are covered automatically.
 */
const INVALID_CHARACTER_REGEX = /[\p{C}\p{Zl}\p{Zp}\u{115F}\u{1160}\u{2800}\u{3164}\u{FFA0}]|\u{034F}/u;

const hasInvalidCharacter = (value: string) => INVALID_CHARACTER_REGEX.test(value);

/**
 * Matches literal `\uXXXX` and `\u{XXXX}` escape sequences stored verbatim as
 * text (e.g. the 6 characters `\`, `u`, `2`, `0`, `0`, `b`), which can still
 * break rendering downstream if anything decodes them.
 */
const ESCAPE_SEQUENCE_PATTERN = /\\u(?:([0-9a-f]{4})|\{([0-9a-f]+)\})/gi;

const hasInvalidEscapeSequence = (value: string) => {
  for (const [, fixedHex, bracedHex] of value.matchAll(ESCAPE_SEQUENCE_PATTERN)) {
    const codePoint = parseInt(fixedHex ?? bracedHex, 16);

    if (codePoint > 0x10ffff) {
      continue;
    }

    // Decode the escape and run it through the same character policy as the
    // unescaped check, so the two can never drift apart.
    if (hasInvalidCharacter(String.fromCodePoint(codePoint))) {
      return true;
    }
  }

  return false;
};

export const hasInvalidTextCharacters = (value: string) =>
  hasInvalidCharacter(value) || hasInvalidEscapeSequence(value);

/**
 * Shared name schema that disallows URLs to prevent phishing via email rendering,
 * and invisible/control characters that render as empty or break the UI.
 */
export const ZNameSchema = z
  .string()
  .trim()
  .min(2, { message: 'Please enter a valid name.' })
  .max(100, { message: 'Name cannot be more than 100 characters.' })
  .refine((value) => !URL_PATTERN.test(value), {
    message: 'Name cannot contain URLs.',
  })
  .refine((value) => !hasInvalidTextCharacters(value), {
    message: 'Name contains invalid characters.',
  });

export type TName = z.infer<typeof ZNameSchema>;
