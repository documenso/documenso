import type { Recipient } from '@prisma/client';

export const extractInitials = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .map((name: string) => name.slice(0, 1).toUpperCase())
    .slice(0, 2)
    .join('');

// \p{L} matches any Unicode letter (accented, CJK, etc). Anchored to the start so tokens that
// begin with punctuation or digits ("-", "(John)", "3rd") contribute nothing instead of a stray symbol.
const LEADING_LETTER_REGEX = /^\p{L}/u;

// Clamp initials to a fixed value so comound names don't overflow.
const MAX_FULL_INITIALS = 8;

export const extractFullInitials = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .map((name) => name.match(LEADING_LETTER_REGEX)?.[0].toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_FULL_INITIALS)
    .join('');

export const recipientAbbreviation = (recipient: Pick<Recipient, 'name' | 'email'>) => {
  return extractFullInitials(recipient.name).slice(0, 3) || recipient.email.slice(0, 1).toUpperCase();
};
