import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const redistributeEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/redistribute',
    summary: 'Redistribute envelope',
    description:
      'Redistribute the envelope to the provided recipients who have not actioned the envelope. Will use the distribution method set in the envelope',
    tags: ['Envelope'],
  },
};

export const ZRedistributeEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  recipients: z
    .array(z.number())
    .min(1)
    .describe('The IDs of the recipients to redistribute the envelope to.'),
});

export const ZRedistributeEnvelopeResponseSchema = z.void();

export type TRedistributeEnvelopeRequest = z.infer<typeof ZRedistributeEnvelopeRequestSchema>;
export type TRedistributeEnvelopeResponse = z.infer<typeof ZRedistributeEnvelopeResponseSchema>;
