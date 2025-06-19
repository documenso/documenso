import { z } from 'zod';

// export const deleteOrganisationMembersMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/member/delete-many',
//     summary: 'Delete organisation members',
//     description: 'Delete organisation members',
//     tags: ['Organisation'],
//   },
// };

export const ZDeleteOrganisationMembersRequestSchema = z.object({
  organisationId: z.string(),
  organisationMemberIds: z
    .array(z.string())
    .refine((items) => new Set(items).size === items.length, {
      message: 'Organisation member ids must be unique, no duplicate values allowed',
    }),
});

export const ZDeleteOrganisationMembersResponseSchema = z.void();
