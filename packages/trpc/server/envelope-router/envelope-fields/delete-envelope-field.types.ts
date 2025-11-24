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
});

export const ZDeleteEnvelopeFieldResponseSchema = ZSuccessResponseSchema;

export type TDeleteEnvelopeFieldRequest = z.infer<typeof ZDeleteEnvelopeFieldRequestSchema>;
export type TDeleteEnvelopeFieldResponse = z.infer<typeof ZDeleteEnvelopeFieldResponseSchema>;
