import { z } from 'zod';

import { ZRecipientLiteSchema } from '@documenso/lib/types/recipient';

import { ZUpdateRecipientSchema } from '../../recipient-router/schema';
import type { TrpcRouteMeta } from '../../trpc';

export const updateEnvelopeRecipientsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/recipient/update-many',
    summary: 'Update envelope recipients',
    description: 'Update multiple recipients for an envelope',
    tags: ['Envelope Recipients'],
  },
};

export const ZUpdateEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZUpdateRecipientSchema.array(),
});

export const ZUpdateEnvelopeRecipientsResponseSchema = z.object({
  data: ZRecipientLiteSchema.array(),
});

export type TUpdateEnvelopeRecipientsRequest = z.infer<
  typeof ZUpdateEnvelopeRecipientsRequestSchema
>;
export type TUpdateEnvelopeRecipientsResponse = z.infer<
  typeof ZUpdateEnvelopeRecipientsResponseSchema
>;
