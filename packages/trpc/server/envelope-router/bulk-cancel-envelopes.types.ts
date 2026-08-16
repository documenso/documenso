import { z } from 'zod';

// Keeping this as a private API for a little while until we're sure it's stable
// and the request/response schemas are finalized.

export const ZBulkCancelEnvelopesRequestSchema = z.object({
  envelopeIds: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe('The IDs of the envelopes to cancel. The maximum number of envelopes you can cancel at once is 100.'),
  reason: z.string().optional(),
});

export const ZBulkCancelEnvelopesResponseSchema = z.object({
  cancelledCount: z.number(),
  failedIds: z.array(z.string()),
});

export type TBulkCancelEnvelopesRequest = z.infer<typeof ZBulkCancelEnvelopesRequestSchema>;
export type TBulkCancelEnvelopesResponse = z.infer<typeof ZBulkCancelEnvelopesResponseSchema>;
