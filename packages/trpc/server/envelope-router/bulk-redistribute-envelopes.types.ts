import { z } from 'zod';

// READ ME: IF YOU UNCOMMENT THIS THEN UNSKIP THE TEST IN api-access-envelope-bulk.spec.ts
// Keeping this as a private API for a little while until we're sure it's stable and the request/response schemas are finalized.
// export const bulkRedistributeEnvelopesMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/bulk/redistribute',
//     summary: 'Bulk redistribute envelopes',
//     description: 'Resend signing reminders to the pending recipients of multiple envelopes.',
//     tags: ['Envelopes'],
//   },
// };

export const ZBulkRedistributeEnvelopesRequestSchema = z.object({
  envelopeIds: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe(
      'The IDs of the envelopes to resend reminders for. The maximum number of envelopes you can resend at once is 100.',
    ),
});

export const ZBulkRedistributeEnvelopesResponseSchema = z.object({
  resentCount: z.number(),
  failedIds: z.array(z.string()),
});

export type TBulkRedistributeEnvelopesRequest = z.infer<
  typeof ZBulkRedistributeEnvelopesRequestSchema
>;
export type TBulkRedistributeEnvelopesResponse = z.infer<
  typeof ZBulkRedistributeEnvelopesResponseSchema
>;
