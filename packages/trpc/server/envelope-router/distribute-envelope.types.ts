import { z } from 'zod';

import { ZDocumentMetaUpdateSchema } from '@documenso/lib/types/document-meta';

import type { TrpcRouteMeta } from '../trpc';

export const distributeEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/distribute',
    summary: 'Distribute envelope',
    description: 'Send the envelope to recipients based on your distribution method',
    tags: ['Envelope'],
  },
};

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
