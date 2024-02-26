import { z } from 'zod';

import { PROTECTED_TEAM_URLS } from '@documenso/lib/constants/teams';
import { TeamMemberRole } from '@documenso/prisma/client';

// Consider refactoring to use ZBaseTableSearchParamsSchema.
const GenericFindQuerySchema = z.object({
  term: z.string().optional(),
  page: z.number().min(1).optional(),
  perPage: z.number().min(1).optional(),
});

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

export const ZAcceptTeamInvitationMutationSchema = z.object({
  teamId: z.number(),
});

export const ZCreateTeamBillingPortalMutationSchema = z.object({
  teamId: z.number(),
});

export const ZCreateTeamMutationSchema = z.object({
  teamName: ZTeamNameSchema,
  teamUrl: ZTeamUrlSchema,
});

export const ZCreateTeamEmailVerificationMutationSchema = z.object({
  teamId: z.number(),
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
  email: z.string().trim().email().toLowerCase().min(1, 'Please enter a valid email.'),
});

export const ZCreateTeamMemberInvitesMutationSchema = z.object({
  teamId: z.number(),
  invitations: z.array(
    z.object({
      email: z.string().email().toLowerCase(),
      role: z.nativeEnum(TeamMemberRole),
    }),
  ),
});

export const ZCreateTeamPendingCheckoutMutationSchema = z.object({
  interval: z.union([z.literal('monthly'), z.literal('yearly')]),
  pendingTeamId: z.number(),
});

export const ZDeleteTeamEmailMutationSchema = z.object({
  teamId: z.number(),
});

export const ZDeleteTeamEmailVerificationMutationSchema = z.object({
  teamId: z.number(),
});

export const ZDeleteTeamMembersMutationSchema = z.object({
  teamId: z.number(),
  teamMemberIds: z.array(z.number()),
});

export const ZDeleteTeamMemberInvitationsMutationSchema = z.object({
  teamId: z.number(),
  invitationIds: z.array(z.number()),
});

export const ZDeleteTeamMutationSchema = z.object({
  teamId: z.number(),
});

export const ZDeleteTeamPendingMutationSchema = z.object({
  pendingTeamId: z.number(),
});

export const ZDeleteTeamTransferRequestMutationSchema = z.object({
  teamId: z.number(),
});

export const ZFindTeamInvoicesQuerySchema = z.object({
  teamId: z.number(),
});

export const ZFindTeamMemberInvitesQuerySchema = GenericFindQuerySchema.extend({
  teamId: z.number(),
});

export const ZFindTeamMembersQuerySchema = GenericFindQuerySchema.extend({
  teamId: z.number(),
});

export const ZFindTeamsQuerySchema = GenericFindQuerySchema;

export const ZFindTeamsPendingQuerySchema = GenericFindQuerySchema;

export const ZGetTeamQuerySchema = z.object({
  teamId: z.number(),
});

export const ZGetTeamMembersQuerySchema = z.object({
  teamId: z.number(),
});

export const ZLeaveTeamMutationSchema = z.object({
  teamId: z.number(),
});

export const ZUpdateTeamMutationSchema = z.object({
  teamId: z.number(),
  data: z.object({
    name: ZTeamNameSchema,
    url: ZTeamUrlSchema,
  }),
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

export const ZRequestTeamOwnerhsipTransferMutationSchema = z.object({
  teamId: z.number(),
  newOwnerUserId: z.number(),
  clearPaymentMethods: z.boolean(),
});

export const ZResendTeamEmailVerificationMutationSchema = z.object({
  teamId: z.number(),
});

export const ZResendTeamMemberInvitationMutationSchema = z.object({
  teamId: z.number(),
  invitationId: z.number(),
});

export type TCreateTeamMutationSchema = z.infer<typeof ZCreateTeamMutationSchema>;
export type TCreateTeamEmailVerificationMutationSchema = z.infer<
  typeof ZCreateTeamEmailVerificationMutationSchema
>;
export type TCreateTeamMemberInvitesMutationSchema = z.infer<
  typeof ZCreateTeamMemberInvitesMutationSchema
>;
export type TCreateTeamPendingCheckoutMutationSchema = z.infer<
  typeof ZCreateTeamPendingCheckoutMutationSchema
>;
export type TDeleteTeamEmailMutationSchema = z.infer<typeof ZDeleteTeamEmailMutationSchema>;
export type TDeleteTeamMembersMutationSchema = z.infer<typeof ZDeleteTeamMembersMutationSchema>;
export type TDeleteTeamMutationSchema = z.infer<typeof ZDeleteTeamMutationSchema>;
export type TDeleteTeamPendingMutationSchema = z.infer<typeof ZDeleteTeamPendingMutationSchema>;
export type TDeleteTeamTransferRequestMutationSchema = z.infer<
  typeof ZDeleteTeamTransferRequestMutationSchema
>;
export type TFindTeamMemberInvitesQuerySchema = z.infer<typeof ZFindTeamMembersQuerySchema>;
export type TFindTeamMembersQuerySchema = z.infer<typeof ZFindTeamMembersQuerySchema>;
export type TFindTeamsQuerySchema = z.infer<typeof ZFindTeamsQuerySchema>;
export type TFindTeamsPendingQuerySchema = z.infer<typeof ZFindTeamsPendingQuerySchema>;
export type TGetTeamQuerySchema = z.infer<typeof ZGetTeamQuerySchema>;
export type TGetTeamMembersQuerySchema = z.infer<typeof ZGetTeamMembersQuerySchema>;
export type TLeaveTeamMutationSchema = z.infer<typeof ZLeaveTeamMutationSchema>;
export type TUpdateTeamMutationSchema = z.infer<typeof ZUpdateTeamMutationSchema>;
export type TUpdateTeamEmailMutationSchema = z.infer<typeof ZUpdateTeamEmailMutationSchema>;
export type TRequestTeamOwnerhsipTransferMutationSchema = z.infer<
  typeof ZRequestTeamOwnerhsipTransferMutationSchema
>;
export type TResendTeamEmailVerificationMutationSchema = z.infer<
  typeof ZResendTeamEmailVerificationMutationSchema
>;
export type TResendTeamMemberInvitationMutationSchema = z.infer<
  typeof ZResendTeamMemberInvitationMutationSchema
>;
