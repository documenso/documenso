import { z } from 'zod';

export const ZGetInvoicesRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to get the invoices for'),
});
