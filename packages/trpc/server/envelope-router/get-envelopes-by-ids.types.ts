import { z } from 'zod';

import { ZEnvelopeSchema } from '@documenso/lib/types/envelope';

import type { TrpcRouteMeta } from '../trpc';

export const getEnvelopesByIdsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/get-many',
    summary: 'Get multiple envelopes',
    description: 'Retrieve multiple envelopes by their IDs',
    tags: ['Envelope'],
  },
};

export const ZGetEnvelopesByIdsRequestSchema = z.object({
  envelopeIds: z.array(z.string()).min(1),
});

export const ZGetEnvelopesByIdsResponseSchema = z.array(ZEnvelopeSchema);

export type TGetEnvelopesByIdsRequest = z.infer<typeof ZGetEnvelopesByIdsRequestSchema>;
export type TGetEnvelopesByIdsResponse = z.infer<typeof ZGetEnvelopesByIdsResponseSchema>;
