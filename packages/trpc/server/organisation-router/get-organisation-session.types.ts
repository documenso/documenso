import { ZOrganisationSchema } from '@documenso/lib/types/organisation';
import { OrganisationMemberRole, TeamMemberRole } from '@documenso/prisma/generated/types';
import SubscriptionSchema from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';
import { TeamEmailSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamEmailSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { z } from 'zod';

/**
 * The shared 2FA enforcement status shape (`TTwoFactorEnforcementStatus` from
 * `@documenso/lib/utils/two-factor`) expressed as a zod schema so it can ride
 * along in the organisation session output.
 */
export const ZTwoFactorEnforcementStatusSchema = z.union([
  z.object({
    required: z.literal(false),
  }),
  z.object({
    required: z.literal(true),
    deadline: z.date(),
    isDeadlineExpired: z.boolean(),
    isSatisfied: z.boolean(),
    isBlocked: z.boolean(),
  }),
]);

export const ZGetOrganisationSessionResponseSchema = ZOrganisationSchema.extend({
  teams: z.array(
    TeamSchema.pick({
      id: true,
      name: true,
      url: true,
      createdAt: true,
      avatarImageId: true,
      organisationId: true,
    }).extend({
      currentTeamRole: z.nativeEnum(TeamMemberRole),
      teamEmail: TeamEmailSchema.pick({ email: true }).nullable(),
      preferences: z.object({
        aiFeaturesEnabled: z.boolean(),
      }),
    }),
  ),
  subscription: SubscriptionSchema.nullable(),
  currentOrganisationRole: z.nativeEnum(OrganisationMemberRole),

  /**
   * Per-organisation 2FA enforcement status for the current user + session,
   * computed server-side. Client layouts derive the org 403 screen and grace
   * banner from this without extra queries.
   */
  twoFactorEnforcement: ZTwoFactorEnforcementStatusSchema,
}).array();

export type TGetOrganisationSessionResponse = z.infer<typeof ZGetOrganisationSessionResponseSchema>;

export type TeamSession = TGetOrganisationSessionResponse[number]['teams'][number];
export type OrganisationSession = TGetOrganisationSessionResponse[number];
