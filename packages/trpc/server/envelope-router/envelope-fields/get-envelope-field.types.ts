import { z } from 'zod';

import { ZEnvelopeFieldSchema } from '@documenso/lib/types/field';

import type { TrpcRouteMeta } from '../../trpc';

export const getEnvelopeFieldMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/field/{fieldId}',
    summary: 'Get envelope field',
    description: 'Returns an envelope field given an ID',
    tags: ['Envelope Fields'],
  },
};

export const ZGetEnvelopeFieldRequestSchema = z.object({
  fieldId: z.number(),
});

export const ZGetEnvelopeFieldResponseSchema = ZEnvelopeFieldSchema;

export type TGetEnvelopeFieldRequest = z.infer<typeof ZGetEnvelopeFieldRequestSchema>;
export type TGetEnvelopeFieldResponse = z.infer<typeof ZGetEnvelopeFieldResponseSchema>;
