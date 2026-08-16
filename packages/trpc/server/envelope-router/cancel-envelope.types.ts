import { z } from 'zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const cancelEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/cancel',
    summary: 'Cancel envelope',
    tags: ['Envelope'],
  },
};

export const ZCancelEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  reason: z.string().optional(),
});

export const ZCancelEnvelopeResponseSchema = ZSuccessResponseSchema;

export type TCancelEnvelopeRequest = z.infer<typeof ZCancelEnvelopeRequestSchema>;
export type TCancelEnvelopeResponse = z.infer<typeof ZCancelEnvelopeResponseSchema>;
