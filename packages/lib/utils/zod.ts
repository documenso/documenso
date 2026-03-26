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
 * A Zod schema for validating email addresses using an RFC 5322 compliant regex.
 *
 * This supports international characters in the local part and domain
 * (e.g. "Søren@gmail.com", "user@dömain.com").
 *
 * Use `zEmail()` if you need to pass a custom error message.
 */
export const ZEmail = z.string().regex(EMAIL_REGEX, { message: DEFAULT_EMAIL_MESSAGE });

/**
 * Creates a Zod email schema with an optional custom error message.
 *
 * @example
 * ```ts
 * // With default message
 * zEmail()
 *
 * // With custom message string
 * zEmail('Email is invalid')
 *
 * // With message object
 * zEmail({ message: 'Email is invalid' })
 * ```
 */
export const zEmail = (options?: string | { message?: string }) => {
  const message =
    typeof options === 'string' ? options : (options?.message ?? DEFAULT_EMAIL_MESSAGE);

  return z.string().regex(EMAIL_REGEX, { message });
};
