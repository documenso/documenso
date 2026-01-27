import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';
import type { TrpcRouteMeta } from '../../trpc';

export const deleteEnvelopeRecipientMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/delete',
    summary: 'Delete envelope recipient',
    description: 'Delete an envelope recipient',
    tags: ['Envelope Recipients'],
  },
};

export const ZDeleteEnvelopeRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZDeleteEnvelopeRecipientResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeRecipientRequest = z.infer<typeof ZDeleteEnvelopeRecipientRequestSchema>;
export type TDeleteEnvelopeRecipientResponse = z.infer<
  typeof ZDeleteEnvelopeRecipientResponseSchema
>;
