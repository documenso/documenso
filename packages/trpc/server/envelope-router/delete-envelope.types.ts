import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';

// export const deleteEnvelopeMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/delete',
//     summary: 'Delete envelope',
//     tags: ['Envelope'],
//   },
// };

export const ZDeleteEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
});

export const ZDeleteEnvelopeResponseSchema = z.void();

export type TDeleteEnvelopeRequest = z.infer<typeof ZDeleteEnvelopeRequestSchema>;
export type TDeleteEnvelopeResponse = z.infer<typeof ZDeleteEnvelopeResponseSchema>;
