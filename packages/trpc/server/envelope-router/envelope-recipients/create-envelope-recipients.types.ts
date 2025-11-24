import { z } from 'zod';

import { ZEnvelopeRecipientLiteSchema } from '@documenso/lib/types/recipient';

import { ZCreateRecipientSchema } from '../../recipient-router/schema';
import type { TrpcRouteMeta } from '../../trpc';

export const createEnvelopeRecipientsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/create-many',
    summary: 'Create envelope recipients',
    description: 'Create multiple recipients for an envelope',
    tags: ['Envelope Recipients'],
  },
};

export const ZCreateEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZCreateRecipientSchema.array(),
});

export const ZCreateEnvelopeRecipientsResponseSchema = z.object({
  data: ZEnvelopeRecipientLiteSchema.array(),
});

export type TCreateEnvelopeRecipientsRequest = z.infer<
  typeof ZCreateEnvelopeRecipientsRequestSchema
>;
export type TCreateEnvelopeRecipientsResponse = z.infer<
  typeof ZCreateEnvelopeRecipientsResponseSchema
>;
