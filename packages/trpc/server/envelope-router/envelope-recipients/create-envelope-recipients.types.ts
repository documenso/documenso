import { z } from 'zod';

import { ZEnvelopeRecipientLiteSchema } from '@documenso/lib/types/recipient';

import { ZCreateRecipientSchema } from '../../recipient-router/schema';

export const ZCreateEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  data: ZCreateRecipientSchema.array(),
});

export const ZCreateEnvelopeRecipientsResponseSchema = z.object({
  recipients: ZEnvelopeRecipientLiteSchema.array(),
});

export type TCreateEnvelopeRecipientsRequest = z.infer<
  typeof ZCreateEnvelopeRecipientsRequestSchema
>;
export type TCreateEnvelopeRecipientsResponse = z.infer<
  typeof ZCreateEnvelopeRecipientsResponseSchema
>;
