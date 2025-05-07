import { z } from 'zod';

// export const deleteOrganisationMemberInvitesMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/member/delete-many',
//     summary: 'Delete organisation member invites',
//     description: 'Delete organisation member invites',
//     tags: ['Organisation'],
//   },
// };

export const ZDeleteOrganisationMemberInvitesRequestSchema = z.object({
  organisationId: z.string(),
  invitationIds: z.array(z.string()).refine((items) => new Set(items).size === items.length, {
    message: 'Invitation IDs must be unique, no duplicate values allowed',
  }),
});

export const ZDeleteOrganisationMemberInvitesResponseSchema = z.void();
