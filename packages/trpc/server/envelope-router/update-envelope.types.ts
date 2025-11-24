import { z } from 'zod';

import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentMetaUpdateSchema } from '@documenso/lib/types/document-meta';
import { ZEnvelopeLiteSchema } from '@documenso/lib/types/envelope';

import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from '../document-router/schema';
import type { TrpcRouteMeta } from '../trpc';

export const updateEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/update',
    summary: 'Update envelope',
    tags: ['Envelope'],
  },
};

export const ZUpdateEnvelopeRequestSchema = z.object({
  envelopeId: z.string(),
  data: z
    .object({
      title: ZDocumentTitleSchema.optional(),
      externalId: ZDocumentExternalIdSchema.nullish(),
      visibility: ZDocumentVisibilitySchema.optional(),
      globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
      globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
      folderId: z.string().nullish(),
    })
    .optional(),
  meta: ZDocumentMetaUpdateSchema.optional(),
});

export const ZUpdateEnvelopeResponseSchema = ZEnvelopeLiteSchema;

export type TUpdateEnvelopeRequest = z.infer<typeof ZUpdateEnvelopeRequestSchema>;
export type TUpdateEnvelopeResponse = z.infer<typeof ZUpdateEnvelopeResponseSchema>;
