import { z } from 'zod';

// export const redistributeEnvelopeMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/redistribute',
//     summary: 'Redistribute document',
//     description:
//       'Redistribute the document to the provided recipients who have not actioned the document. Will use the distribution method set in the document',
//     tags: ['Envelope'],
//   },
// };

export const ZRedistributeEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  recipients: z
    .array(z.number())
    .min(1)
    .describe('The IDs of the recipients to redistribute the envelope to.'),
});

export const ZRedistributeEnvelopeResponseSchema = z.void();

export type TRedistributeEnvelopeRequest = z.infer<typeof ZRedistributeEnvelopeRequestSchema>;
export type TRedistributeEnvelopeResponse = z.infer<typeof ZRedistributeEnvelopeResponseSchema>;
