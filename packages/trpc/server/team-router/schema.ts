import { z } from 'zod';

import { PROTECTED_TEAM_URLS } from '@documenso/lib/constants/teams';

/**
 * Restrict team URLs schema.
 *
 * Allowed characters:
 * - Alphanumeric
 * - Lowercase
 * - Dashes
 * - Underscores
 *
 * Conditions:
 * - 3-30 characters
 * - Cannot start and end with underscores or dashes.
 * - Cannot contain consecutive underscores or dashes.
 * - Cannot be a reserved URL in the PROTECTED_TEAM_URLS list
 */
export const ZTeamUrlSchema = z
  .string()
  .trim()
  .min(3, { message: 'Team URL must be at least 3 characters long.' })
  .max(30, { message: 'Team URL must not exceed 30 characters.' })
  .toLowerCase()
  .regex(/^[a-z0-9].*[^_-]$/, 'Team URL cannot start or end with dashes or underscores.')
  .regex(/^(?!.*[-_]{2})/, 'Team URL cannot contain consecutive dashes or underscores.')
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
    'Team URL can only contain letters, numbers, dashes and underscores.',
  )
  .refine((value) => !PROTECTED_TEAM_URLS.includes(value), {
    message: 'This URL is already in use.',
  });

export const ZTeamNameSchema = z
  .string()
  .trim()
  .min(3, { message: 'Team name must be at least 3 characters long.' })
  .max(30, { message: 'Team name must not exceed 30 characters.' });
