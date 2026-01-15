import { z } from 'zod';

import { ZDetectedRecipientSchema } from '@documenso/lib/server-only/ai/envelope/detect-recipients/schema';

export const ZDetectRecipientsRequestSchema = z.object({
  envelopeId: z.string().min(1).describe('The ID of the envelope to detect recipients from.'),
  teamId: z.number().describe('The ID of the team the envelope belongs to.'),
});

export type TDetectRecipientsRequest = z.infer<typeof ZDetectRecipientsRequestSchema>;

export const ZDetectRecipientsResponseSchema = z.object({
  recipients: z.array(ZDetectedRecipientSchema),
});

export type TDetectRecipientsResponse = z.infer<typeof ZDetectRecipientsResponseSchema>;
