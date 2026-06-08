import { z } from 'zod';

export const ZGetOrganisationQuotaFlagsRequestSchema = z.object({
  organisationId: z.string().describe('The ID of the organisation.'),
});

/**
 * Booleans only. Raw usage counts and quota caps are intentionally never
 * surfaced to the client.
 */
export const ZGetOrganisationQuotaFlagsResponseSchema = z.object({
  isDocumentQuotaExceeded: z.boolean(),
  isEmailQuotaExceeded: z.boolean(),
  isApiQuotaExceeded: z.boolean(),
});

export type TGetOrganisationQuotaFlagsResponse = z.infer<typeof ZGetOrganisationQuotaFlagsResponseSchema>;
