import { z } from 'zod';

export const ZGetEnvelopeFieldSignaturesRequestSchema = z.object({
  envelopeId: z.string().min(1),
});

export const ZGetEnvelopeFieldSignaturesResponseSchema = z
  .object({
    fieldId: z.number(),
    signatureImageAsBase64: z.string().nullable(),
    typedSignature: z.string().nullable(),
  })
  .array();

export type TGetEnvelopeFieldSignaturesRequest = z.infer<
  typeof ZGetEnvelopeFieldSignaturesRequestSchema
>;
export type TGetEnvelopeFieldSignaturesResponse = z.infer<
  typeof ZGetEnvelopeFieldSignaturesResponseSchema
>;
