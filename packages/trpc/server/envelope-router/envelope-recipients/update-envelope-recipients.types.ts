import { z } from 'zod';

import { ZRecipientLiteSchema } from '@documenso/lib/types/recipient';

import { ZUpdateRecipientSchema } from '../../recipient-router/schema';

export const ZUpdateEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZUpdateRecipientSchema.array(),
});

export const ZUpdateEnvelopeRecipientsResponseSchema = z.object({
  recipients: ZRecipientLiteSchema.array(),
});

export type TUpdateEnvelopeRecipientsRequest = z.infer<
  typeof ZUpdateEnvelopeRecipientsRequestSchema
>;
export type TUpdateEnvelopeRecipientsResponse = z.infer<
  typeof ZUpdateEnvelopeRecipientsResponseSchema
>;
