import { z } from 'zod';

export const ZCreateSubscriptionRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to create the subscription for'),
  priceId: z.string().describe('The price to create the subscription for'),
});
