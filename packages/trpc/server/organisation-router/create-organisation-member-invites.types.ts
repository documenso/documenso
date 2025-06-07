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
    .min(1)
    .refine(
      (invitations) => {
        const emails = invitations
          .filter((invitation) => invitation.email !== undefined)
          .map((invitation) => invitation.email);

        return new Set(emails).size === emails.length;
      },
      {
        message: 'Emails must be unique, no duplicate values allowed',
      },
    ),
});

export const ZCreateOrganisationMemberInvitesResponseSchema = z.void();

export type TCreateOrganisationMemberInvitesRequestSchema = z.infer<
  typeof ZCreateOrganisationMemberInvitesRequestSchema
>;
