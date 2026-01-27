import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const downloadEnvelopeItemMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/item/{envelopeItemId}/download',
    summary: 'Download an envelope item',
    description: 'Download an envelope item by its ID',
    tags: ['Envelope Items'],
    responseHeaders: z.object({
      'Content-Type': z.literal('application/pdf'),
    }),
  },
};

export const ZDownloadEnvelopeItemRequestSchema = z.object({
  envelopeItemId: z.string().describe('The ID of the envelope item to download.'),
  version: z
    .enum(['original', 'signed'])
    .describe(
      'The version of the envelope item to download. "signed" returns the completed document with signatures, "original" returns the original uploaded document.',
    )
    .default('signed'),
});

export const ZDownloadEnvelopeItemResponseSchema = z.instanceof(Uint8Array);

export type TDownloadEnvelopeItemRequest = z.infer<typeof ZDownloadEnvelopeItemRequestSchema>;
export type TDownloadEnvelopeItemResponse = z.infer<typeof ZDownloadEnvelopeItemResponseSchema>;
