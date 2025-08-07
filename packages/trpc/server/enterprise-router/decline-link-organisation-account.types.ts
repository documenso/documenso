import { z } from 'zod';

export const ZDeclineLinkOrganisationAccountRequestSchema = z.object({
  token: z.string(),
});

export const ZDeclineLinkOrganisationAccountResponseSchema = z.void();

export type TDeclineLinkOrganisationAccountRequest = z.infer<
  typeof ZDeclineLinkOrganisationAccountRequestSchema
>;
