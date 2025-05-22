import { z } from 'zod';

export const ZAcceptOrganisationMemberInviteRequestSchema = z.object({
  token: z.string(),
});

export const ZAcceptOrganisationMemberInviteResponseSchema = z.void();

export type TAcceptOrganisationMemberInviteResponse = z.infer<
  typeof ZAcceptOrganisationMemberInviteResponseSchema
>;
