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

export const ZEnvelopeIdsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('envelopeId'),
    ids: z.array(z.string()).min(1).max(20),
  }),
  z.object({
    type: z.literal('documentId'),
    ids: z.array(z.number()).min(1).max(20),
  }),
  z.object({
    type: z.literal('templateId'),
    ids: z.array(z.number()).min(1).max(20),
  }),
]);

export const ZGetEnvelopesByIdsRequestSchema = z.object({
  ids: ZEnvelopeIdsSchema,
});

export const ZGetEnvelopesByIdsResponseSchema = z.object({
  data: z.array(ZEnvelopeSchema),
});

export type TGetEnvelopesByIdsRequest = z.infer<typeof ZGetEnvelopesByIdsRequestSchema>;
export type TGetEnvelopesByIdsResponse = z.infer<typeof ZGetEnvelopesByIdsResponseSchema>;
