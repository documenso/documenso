import { z } from 'zod';

import { ZSuccessResponseSchema } from '../../schema';
import type { TrpcRouteMeta } from '../../trpc';

export const deleteEnvelopeFieldMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/field/delete',
    summary: 'Delete envelope field',
    description: 'Delete an envelope field',
    tags: ['Envelope Fields'],
  },
};

export const ZDeleteEnvelopeFieldRequestSchema = z.object({
  fieldId: z.number(),
  force: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "When true, proceed even if the field is referenced by other fields' visibility rules. Dangling rules will be stripped.",
    ),
});

export const ZDeleteEnvelopeFieldResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeFieldRequest = z.infer<typeof ZDeleteEnvelopeFieldRequestSchema>;
export type TDeleteEnvelopeFieldResponse = z.infer<typeof ZDeleteEnvelopeFieldResponseSchema>;
