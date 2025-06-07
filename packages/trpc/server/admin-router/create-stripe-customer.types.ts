import { z } from 'zod';

export const ZCreateStripeCustomerRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to attach the customer to'),
});

export const ZCreateStripeCustomerResponseSchema = z.void();

export type TCreateStripeCustomerRequest = z.infer<typeof ZCreateStripeCustomerRequestSchema>;
