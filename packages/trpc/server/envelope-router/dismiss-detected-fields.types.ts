import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const dismissDetectedFieldsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/item/dismiss-detected-fields',
    summary: 'Dismiss detected fields',
    description:
      'Clear the auto-detected form fields stored on envelope items once they have been imported or skipped.',
    tags: ['Envelope Items'],
  },
};

export const ZDismissDetectedFieldsRequestSchema = z.object({
  envelopeId: z.string(),
  /**
   * The envelope item IDs to clear detected fields for. When omitted, detected
   * fields are cleared for every item in the envelope.
   */
  envelopeItemIds: z.string().array().optional(),
});

export const ZDismissDetectedFieldsResponseSchema = z.object({
  success: z.boolean(),
});

export type TDismissDetectedFieldsRequest = z.infer<typeof ZDismissDetectedFieldsRequestSchema>;
export type TDismissDetectedFieldsResponse = z.infer<typeof ZDismissDetectedFieldsResponseSchema>;
