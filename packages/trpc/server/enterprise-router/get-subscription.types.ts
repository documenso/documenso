import { z } from 'zod';

export const ZGetSubscriptionRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to get the subscription for'),
});
