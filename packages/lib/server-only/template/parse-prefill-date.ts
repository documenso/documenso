// ABOUTME: Pure helper that parses a prefill date string into a Luxon DateTime.
// Accepts ISO 8601 dates and US numeric formats (M/d/yyyy, MM/dd/yyyy).
import { DateTime } from 'luxon';

/**
 * Parses a date string from bulk-send CSV input in a locale-independent way.
 * Returns a valid DateTime on success, or null if the input cannot be parsed.
 *
 * Accepted formats (in priority order):
 *   1. ISO 8601 (e.g. 2026-06-07)
 *   2. M/d/yyyy  (e.g. 6/7/2026)
 *   3. MM/dd/yyyy (e.g. 06/07/2026)
 */
export const parsePrefillDate = (value: string): DateTime | null => {
  const iso = DateTime.fromISO(value);
  if (iso.isValid) {
    return iso;
  }

  const mdy = DateTime.fromFormat(value, 'M/d/yyyy');
  if (mdy.isValid) {
    return mdy;
  }

  const mmddyyyy = DateTime.fromFormat(value, 'MM/dd/yyyy');
  if (mmddyyyy.isValid) {
    return mmddyyyy;
  }

  return null;
};
