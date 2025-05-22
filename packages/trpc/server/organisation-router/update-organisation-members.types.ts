import { OrganisationMemberRole } from '@prisma/client';
import { z } from 'zod';

// export const updateOrganisationMemberMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/member/update',
//     summary: 'Update organisation member',
//     description: 'Update organisation member',
//     tags: ['Organisation'],
//   },
// };

export const ZUpdateOrganisationMemberRequestSchema = z.object({
  organisationId: z.string(),
  organisationMemberId: z.string(),
  data: z.object({
    role: z.nativeEnum(OrganisationMemberRole),
  }),
});

export const ZUpdateOrganisationMemberResponseSchema = z.void();
