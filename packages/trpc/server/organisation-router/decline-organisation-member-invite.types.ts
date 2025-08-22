import { z } from 'zod';

export const ZDeclineOrganisationMemberInviteRequestSchema = z.object({
  token: z.string(),
});

export const ZDeclineOrganisationMemberInviteResponseSchema = z.void();

export type TDeclineOrganisationMemberInviteResponse = z.infer<
  typeof ZDeclineOrganisationMemberInviteResponseSchema
>;
