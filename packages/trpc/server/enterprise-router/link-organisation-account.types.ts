import { z } from 'zod';

export const ZLinkOrganisationAccountRequestSchema = z.object({
  token: z.string(),
});

export const ZLinkOrganisationAccountResponseSchema = z.void();

export type TLinkOrganisationAccountRequest = z.infer<typeof ZLinkOrganisationAccountRequestSchema>;
