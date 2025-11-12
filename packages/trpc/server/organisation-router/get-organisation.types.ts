import { z } from 'zod';

import { ZOrganisationSchema } from '@documenso/lib/types/organisation';
import OrganisationClaimSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationClaimSchema';
import OrganisationGlobalSettingsSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationGlobalSettingsSchema';
import OrganisationMemberSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationMemberSchema';
import SubscriptionSchema from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

// export const getOrganisationMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/organisation/{teamReference}',
//     summary: 'Get organisation',
//     description: 'Get an organisation by ID or URL',
//     tags: ['Organisation'],
//   },
// };

export const ZGetOrganisationRequestSchema = z.object({
  organisationReference: z.string().describe('The ID or URL of the organisation.'),
});

export const ZGetOrganisationResponseSchema = ZOrganisationSchema.extend({
  organisationGlobalSettings: OrganisationGlobalSettingsSchema,
  organisationClaim: OrganisationClaimSchema,
  subscription: SubscriptionSchema.nullable(),
  members: z.array(
    OrganisationMemberSchema.pick({
      id: true,
    }),
  ),
  teams: z.array(
    TeamSchema.pick({
      id: true,
      name: true,
      url: true,
      createdAt: true,
      avatarImageId: true,
      organisationId: true,
    }),
  ),
});

export type TGetOrganisationResponse = z.infer<typeof ZGetOrganisationResponseSchema>;
