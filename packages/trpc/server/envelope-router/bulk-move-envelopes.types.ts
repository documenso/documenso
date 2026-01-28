import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';

// READ ME: IF YOU UNCOMMENT THIS THEN UNSKIP THE TEST IN api-access-envelope-bulk.spec.ts
// Keeping this as a private API for a little while until we're sure it's stable and the request/response schemas are finalized.
// export const bulkMoveEnvelopesMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/bulk/move',
//     summary: 'Bulk move envelopes to folder',
//     description: 'Move multiple envelopes to a specified folder.',
//     tags: ['Envelopes'],
//   },
// };

export const ZBulkMoveEnvelopesRequestSchema = z.object({
  envelopeIds: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe(
      'The IDs of the envelopes to move. The maximum number of envelopes you can move at once is 100.',
    ),
  envelopeType: z.nativeEnum(EnvelopeType),
  folderId: z
    .string()
    .nullable()
    .describe(
      'The ID of the folder to move the envelopes to. If null folder will be moved to the root folder.',
    ),
});

export const ZBulkMoveEnvelopesResponseSchema = z.object({
  movedCount: z.number().describe('The number of envelopes that were moved.'),
});

export type TBulkMoveEnvelopesRequest = z.infer<typeof ZBulkMoveEnvelopesRequestSchema>;
export type TBulkMoveEnvelopesResponse = z.infer<typeof ZBulkMoveEnvelopesResponseSchema>;
