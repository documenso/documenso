// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { ZDocumentLiteSchema } from '@documenso/lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentMetaUpdateSchema } from '@documenso/lib/types/document-meta';

import type { TrpcRouteMeta } from '../trpc';
import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from './schema';

export const updateDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/update',
    summary: 'Update document',
    tags: ['Document'],
  },
};

export const ZUpdateDocumentRequestSchema = z.object({
  documentId: z.number(),
  data: z
    .object({
      title: ZDocumentTitleSchema.optional(),
      externalId: ZDocumentExternalIdSchema.nullish(),
      visibility: ZDocumentVisibilitySchema.optional(),
      globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
      globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
      useLegacyFieldInsertion: z.boolean().optional(),
      folderId: z.string().nullish(),
    })
    .optional(),
  meta: ZDocumentMetaUpdateSchema.optional(),
});

export const ZUpdateDocumentResponseSchema = ZDocumentLiteSchema;
