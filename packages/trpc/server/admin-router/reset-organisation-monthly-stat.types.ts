import { z } from 'zod';

export const ZResetOrganisationMonthlyStatRequestSchema = z.object({
  organisationId: z.string(),
  counter: z.enum(['document', 'email', 'api']),
});

export const ZResetOrganisationMonthlyStatResponseSchema = z.void();

export type TResetOrganisationMonthlyStatRequest = z.infer<typeof ZResetOrganisationMonthlyStatRequestSchema>;
