import { z } from 'zod';

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

export const ZDeleteEnvelopeFieldResponseSchema = z.void();

export type TDeleteEnvelopeFieldRequest = z.infer<typeof ZDeleteEnvelopeFieldRequestSchema>;
export type TDeleteEnvelopeFieldResponse = z.infer<typeof ZDeleteEnvelopeFieldResponseSchema>;
