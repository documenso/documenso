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
  const message =
    typeof options === 'string' ? options : (options?.message ?? DEFAULT_EMAIL_MESSAGE);

  return z.string().regex(EMAIL_REGEX, { message });
};
