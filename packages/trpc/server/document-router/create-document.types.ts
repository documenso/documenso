import { z } from 'zod';
import { zfd } from 'zod-form-data';

import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentFormValuesSchema } from '@documenso/lib/types/document-form-values';
import { ZDocumentMetaCreateSchema } from '@documenso/lib/types/document-meta';
import { ZDocumentVisibilitySchema } from '@documenso/lib/types/document-visibility';
import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';
import {
  ZFieldHeightSchema,
  ZFieldPageNumberSchema,
  ZFieldPageXSchema,
  ZFieldPageYSchema,
  ZFieldWidthSchema,
} from '@documenso/lib/types/field';
import { ZFieldAndMetaSchema } from '@documenso/lib/types/field-meta';

import { zodFormData } from '../../utils/zod-form-data';
import { ZCreateRecipientSchema } from '../recipient-router/schema';
import type { TrpcRouteMeta } from '../trpc';
import { ZDocumentExternalIdSchema, ZDocumentTitleSchema } from './schema';

export const createDocumentMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/create',
    contentTypes: ['multipart/form-data'],
    summary: 'Create document',
    description: 'Create a document using form data.',
    tags: ['Document'],
  },
};

export const ZCreateDocumentPayloadSchema = z.object({
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

export const ZCreateDocumentRequestSchema = zodFormData({
  payload: zfd.json(ZCreateDocumentPayloadSchema),
  file: zfd.file(),
});

export const ZCreateDocumentResponseSchema = z.object({
  envelopeId: z.string(),
  id: z.number(),
});

export type TCreateDocumentPayloadSchema = z.infer<typeof ZCreateDocumentPayloadSchema>;
export type TCreateDocumentRequest = z.infer<typeof ZCreateDocumentRequestSchema>;
export type TCreateDocumentResponse = z.infer<typeof ZCreateDocumentResponseSchema>;
