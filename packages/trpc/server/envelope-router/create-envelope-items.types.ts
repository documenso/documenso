import { z } from 'zod';
import { zfd } from 'zod-form-data';

import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';

import { zodFormData } from '../../utils/zod-form-data';
import type { TrpcRouteMeta } from '../trpc';

export const createEnvelopeItemsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/item/create-many',
    summary: 'Create envelope items',
    contentTypes: ['multipart/form-data'],
    description: 'Create multiple envelope items for an envelope',
    tags: ['Envelope Items'],
  },
};

export const ZCreateEnvelopeItemsPayloadSchema = z.object({
  envelopeId: z.string(),
  // data: z.object() // Currently not used.
});

export const ZCreateEnvelopeItemsRequestSchema = zodFormData({
  payload: zfd.json(ZCreateEnvelopeItemsPayloadSchema),
  files: zfd.repeatableOfType(zfd.file()),
});

export const ZCreateEnvelopeItemsResponseSchema = z.object({
  data: EnvelopeItemSchema.pick({
    id: true,
    title: true,
    envelopeId: true,
    order: true,
  }).array(),
});

export type TCreateEnvelopeItemsPayload = z.infer<typeof ZCreateEnvelopeItemsPayloadSchema>;
export type TCreateEnvelopeItemsRequest = z.infer<typeof ZCreateEnvelopeItemsRequestSchema>;
export type TCreateEnvelopeItemsResponse = z.infer<typeof ZCreateEnvelopeItemsResponseSchema>;
