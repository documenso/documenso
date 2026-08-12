import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const duplicateEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/duplicate',
    summary: 'Duplicate envelope',
    description: 'Duplicate an envelope with all its settings',
    tags: ['Envelope'],
  },
};

export const ZDuplicateEnvelopeRequestSchema = z.object({
  envelopeId: z.string().min(1).describe('The ID of the envelope to duplicate.'),
  includeRecipients: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to copy the recipients to the duplicated envelope. Defaults to true.'),
  includeFields: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to copy the fields to the duplicated envelope. Requires includeRecipients. Defaults to true.'),
});

export const ZDuplicateEnvelopeResponseSchema = z.object({
  id: z.string().describe('The ID of the newly created envelope.'),
});

export type TDuplicateEnvelopeRequest = z.infer<typeof ZDuplicateEnvelopeRequestSchema>;
export type TDuplicateEnvelopeResponse = z.infer<typeof ZDuplicateEnvelopeResponseSchema>;
