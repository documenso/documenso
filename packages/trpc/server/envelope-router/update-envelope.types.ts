import { ZDocumentAccessAuthTypesSchema, ZDocumentActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { ZDocumentMetaUpdateSchema } from '@documenso/lib/types/document-meta';
import { ZEnvelopeLiteSchema } from '@documenso/lib/types/envelope';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';

import { ZDocumentExternalIdSchema, ZDocumentTitleSchema, ZDocumentVisibilitySchema } from '../document-router/schema';
import type { TrpcRouteMeta } from '../trpc';

export const updateEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/update',
    summary: 'Update envelope',
    description: 'Update envelope properties and settings',
    tags: ['Envelope'],
  },
};

export const ZUpdateEnvelopeRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to update.'),
  data: z
    .object({
      title: ZDocumentTitleSchema.optional(),
      externalId: ZDocumentExternalIdSchema.nullish(),
      visibility: ZDocumentVisibilitySchema.optional(),
      globalAccessAuth: z
        .array(ZDocumentAccessAuthTypesSchema)
        .describe('The authentication methods required to access the envelope.')
        .optional(),
      globalActionAuth: z
        .array(ZDocumentActionAuthTypesSchema)
        .describe('The authentication methods required to sign the envelope.')
        .optional(),
      folderId: z.string().describe('The ID of the folder containing the envelope.').nullish(),
      templateType: z.nativeEnum(TemplateType).describe('The template type.').optional(),
    })
    .describe('The envelope properties to update.')
    .optional(),
  meta: ZDocumentMetaUpdateSchema.describe('The email and signing settings to update.').optional(),
});

export const ZUpdateEnvelopeResponseSchema = ZEnvelopeLiteSchema;

export type TUpdateEnvelopeRequest = z.infer<typeof ZUpdateEnvelopeRequestSchema>;
export type TUpdateEnvelopeResponse = z.infer<typeof ZUpdateEnvelopeResponseSchema>;
