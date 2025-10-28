import { z } from 'zod';

import { ZEnvelopeSchema } from '@documenso/lib/types/envelope';

export const ZGetEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZGetEnvelopeResponseSchema = ZEnvelopeSchema;

export type TGetEnvelopeRequest = z.infer<typeof ZGetEnvelopeRequestSchema>;
export type TGetEnvelopeResponse = z.infer<typeof ZGetEnvelopeResponseSchema>;
