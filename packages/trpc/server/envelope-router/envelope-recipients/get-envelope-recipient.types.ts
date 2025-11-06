import { z } from 'zod';

import { ZEnvelopeRecipientSchema } from '@documenso/lib/types/recipient';

import type { TrpcRouteMeta } from '../../trpc';

export const getEnvelopeRecipientMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/recipient/{recipientId}',
    summary: 'Get envelope recipient',
    description: 'Returns an envelope recipient given an ID',
    tags: ['Envelope Recipients'],
  },
};

export const ZGetEnvelopeRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZGetEnvelopeRecipientResponseSchema = ZEnvelopeRecipientSchema;

export type TGetEnvelopeRecipientRequest = z.infer<typeof ZGetEnvelopeRecipientRequestSchema>;
export type TGetEnvelopeRecipientResponse = z.infer<typeof ZGetEnvelopeRecipientResponseSchema>;
