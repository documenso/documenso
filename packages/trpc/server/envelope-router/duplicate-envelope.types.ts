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
  envelopeId: z.string(),
});

export const ZDuplicateEnvelopeResponseSchema = z.object({
  id: z.string().describe('The ID of the newly created envelope.'),
});

export type TDuplicateEnvelopeRequest = z.infer<typeof ZDuplicateEnvelopeRequestSchema>;
export type TDuplicateEnvelopeResponse = z.infer<typeof ZDuplicateEnvelopeResponseSchema>;
