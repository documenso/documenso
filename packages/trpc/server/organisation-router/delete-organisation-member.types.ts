import { z } from 'zod';

// export const deleteOrganisationMemberMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/member/delete',
//     summary: 'Delete organisation member',
//     description: 'Delete organisation member',
//     tags: ['Organisation'],
//   },
// };

export const ZDeleteOrganisationMemberRequestSchema = z.object({
  organisationId: z.string(),
  organisationMemberId: z.string(),
});

export const ZDeleteOrganisationMemberResponseSchema = z.void();
