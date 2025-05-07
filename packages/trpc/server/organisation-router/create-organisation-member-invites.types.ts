import { OrganisationMemberRole } from '@prisma/client';
import { z } from 'zod';

// export const createOrganisationMemberInvitesMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/organisation/member/create',
//     summary: 'Invite organisation members',
//     description: 'Invite a users to be part of your organisation',
//     tags: ['Organisation'],
//   },
// };

export const ZCreateOrganisationMemberInvitesRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to invite the user to'),
  invitations: z
    .array(
      z.object({
        email: z.string().trim().email().toLowerCase(),
        organisationRole: z.nativeEnum(OrganisationMemberRole),
      }),
    )
    // Todo: orgs this probably doesn't work
    .refine((items) => new Set(items).size === items.length, {
      message: 'Emails must be unique, no duplicate values allowed',
    }),
});

export const ZCreateOrganisationMemberInvitesResponseSchema = z.void();

export type TCreateOrganisationMemberInvitesRequestSchema = z.infer<
  typeof ZCreateOrganisationMemberInvitesRequestSchema
>;
