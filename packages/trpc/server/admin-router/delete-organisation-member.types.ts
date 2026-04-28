import { z } from 'zod';

export const ZDeleteAdminOrganisationMemberRequestSchema = z.object({
  organisationId: z.string().min(1),
  organisationMemberId: z.string().min(1),
});

export const ZDeleteAdminOrganisationMemberResponseSchema = z.void();

export type TDeleteAdminOrganisationMemberRequest = z.infer<
  typeof ZDeleteAdminOrganisationMemberRequestSchema
>;
export type TDeleteAdminOrganisationMemberResponse = z.infer<
  typeof ZDeleteAdminOrganisationMemberResponseSchema
>;
