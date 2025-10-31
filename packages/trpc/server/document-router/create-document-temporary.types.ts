import { z } from 'zod';

import { ZDocumentSchema } from '@documenso/lib/types/document';
import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentFormValuesSchema } from '@documenso/lib/types/document-form-values';
import { ZDocumentMetaCreateSchema } from '@documenso/lib/types/document-meta';
import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';
import {
  ZFieldHeightSchema,
  ZFieldPageNumberSchema,
  ZFieldPageXSchema,
  ZFieldPageYSchema,
  ZFieldWidthSchema,
} from '@documenso/lib/types/field';
import { ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';

import { ZCreateRecipientSchema } from '../recipient-router/schema';
import type { TrpcRouteMeta } from '../trpc';
import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from './schema';

/**
 * Temporariy endpoint for V2 Beta until we allow passthrough documents on create.
 */
export const createDocumentTemporaryMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/create/beta',
    summary: 'Create document',
    description:
      'You will need to upload the PDF to the provided URL returned. Note: Once V2 API is released, this will be removed since we will allow direct uploads, instead of using an upload URL.',
    tags: ['Document'],
  },
};

export const ZCreateDocumentTemporaryRequestSchema = z.object({
  title: ZDocumentTitleSchema,
  externalId: ZDocumentExternalIdSchema.optional(),
  visibility: ZDocumentVisibilitySchema.optional(),
  globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
  formValues: ZDocumentFormValuesSchema.optional(),
  folderId: z
    .string()
    .describe(
      'The ID of the folder to create the document in. If not provided, the document will be created in the root folder.',
    )
    .optional(),
  recipients: z
    .array(
      ZCreateRecipientSchema.extend({
        fields: ZFieldAndMetaSchema.and(
          z.object({
            pageNumber: ZFieldPageNumberSchema,
            pageX: ZFieldPageXSchema,
            pageY: ZFieldPageYSchema,
            width: ZFieldWidthSchema,
            height: ZFieldHeightSchema,
          }),
        )
          .array()
          .optional(),
      }),
    )

    .optional(),
  attachments: z
    .array(
      z.object({
        label: z.string().min(1, 'Label is required'),
        data: z.string().url('Must be a valid URL'),
        type: ZEnvelopeAttachmentTypeSchema.optional().default('link'),
      }),
    )
    .optional(),
  meta: ZDocumentMetaCreateSchema.optional(),
});

export const ZCreateDocumentTemporaryResponseSchema = z.object({
  document: ZDocumentSchema,
  uploadUrl: z
    .string()
    .describe(
      'The URL to upload the document PDF to. Use a PUT request with the file via form-data',
    ),
});

export type TCreateDocumentTemporaryRequest = z.infer<typeof ZCreateDocumentTemporaryRequestSchema>;
export type TCreateDocumentTemporaryResponse = z.infer<
  typeof ZCreateDocumentTemporaryResponseSchema
>;
