import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const deleteEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/delete',
    summary: 'Delete envelope',
    tags: ['Envelope'],
  },
};

export const ZDeleteEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZDeleteEnvelopeResponseSchema = z.void();

export type TDeleteEnvelopeRequest = z.infer<typeof ZDeleteEnvelopeRequestSchema>;
export type TDeleteEnvelopeResponse = z.infer<typeof ZDeleteEnvelopeResponseSchema>;
