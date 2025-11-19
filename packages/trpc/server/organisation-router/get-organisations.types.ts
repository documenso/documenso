import { z } from 'zod';

import { ZOrganisationManySchema } from '@doku-seal/lib/types/organisation';
import OrganisationMemberRoleSchema from '@doku-seal/prisma/generated/zod/inputTypeSchemas/OrganisationMemberRoleSchema';

// export const getOrganisationsMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/organisation/teams',
//     summary: 'Get teams',
//     description: 'Get all teams you are a member of',
//     tags: ['Organisation'],
//   },
// };

export const ZGetOrganisationsRequestSchema = z.void();

export const ZGetOrganisationsResponseSchema = ZOrganisationManySchema.extend({
  currentOrganisationRole: OrganisationMemberRoleSchema,
  currentMemberId: z.string(),
}).array();

export type TGetOrganisationsResponse = z.infer<typeof ZGetOrganisationsResponseSchema>;
