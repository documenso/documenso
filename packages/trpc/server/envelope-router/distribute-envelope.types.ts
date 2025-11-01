import { z } from 'zod';

import { ZDocumentMetaUpdateSchema } from '@documenso/lib/types/document-meta';

export const ZDistributeEnvelopeRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to send.'),
  meta: ZDocumentMetaUpdateSchema.pick({
    subject: true,
    message: true,
    timezone: true,
    dateFormat: true,
    distributionMethod: true,
    redirectUrl: true,
    language: true,
    emailId: true,
    emailReplyTo: true,
    emailSettings: true,
  }).optional(),
});

export const ZDistributeEnvelopeResponseSchema = z.void();

export type TDistributeEnvelopeRequest = z.infer<typeof ZDistributeEnvelopeRequestSchema>;
export type TDistributeEnvelopeResponse = z.infer<typeof ZDistributeEnvelopeResponseSchema>;
