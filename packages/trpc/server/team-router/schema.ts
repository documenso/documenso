import { TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

import { PROTECTED_TEAM_URLS } from '@documenso/lib/constants/teams';

export const MAX_PROFILE_BIO_LENGTH = 256;

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

export const ZCreateTeamEmailVerificationMutationSchema = z.object({
  teamId: z.number(),
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
  email: z.string().trim().email().toLowerCase().min(1, 'Please enter a valid email.'),
});

export const ZDeleteTeamEmailMutationSchema = z.object({
  teamId: z.number(),
});

export const ZDeleteTeamEmailVerificationMutationSchema = z.object({
  teamId: z.number(),
});

export const ZGetTeamMembersQuerySchema = z.object({
  teamId: z.number(),
});

export const ZUpdateTeamEmailMutationSchema = z.object({
  teamId: z.number(),
  data: z.object({
    name: z.string().trim().min(1),
  }),
});

export const ZUpdateTeamMemberMutationSchema = z.object({
  teamId: z.number(),
  teamMemberId: z.number(),
  data: z.object({
    role: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZUpdateTeamPublicProfileMutationSchema = z.object({
  bio: z
    .string()
    .max(MAX_PROFILE_BIO_LENGTH, {
      message: `Bio must be shorter than ${MAX_PROFILE_BIO_LENGTH + 1} characters`,
    })
    .optional(),
  enabled: z.boolean().optional(),
  url: ZTeamUrlSchema.optional(),
  teamId: z.number(),
});

export const ZResendTeamEmailVerificationMutationSchema = z.object({
  teamId: z.number(),
});

export type TCreateTeamEmailVerificationMutationSchema = z.infer<
  typeof ZCreateTeamEmailVerificationMutationSchema
>;

export type TDeleteTeamEmailMutationSchema = z.infer<typeof ZDeleteTeamEmailMutationSchema>;
export type TGetTeamMembersQuerySchema = z.infer<typeof ZGetTeamMembersQuerySchema>;
export type TUpdateTeamEmailMutationSchema = z.infer<typeof ZUpdateTeamEmailMutationSchema>;
export type TResendTeamEmailVerificationMutationSchema = z.infer<
  typeof ZResendTeamEmailVerificationMutationSchema
>;
