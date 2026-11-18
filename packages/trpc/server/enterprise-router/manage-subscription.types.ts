import { z } from 'zod';

export const ZManageSubscriptionRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to manage the subscription for'),
});
