import { z } from 'zod';
import { zfd } from 'zod-form-data';

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

import { zodFormData } from '../../utils/zod-form-data';
import { ZCreateRecipientSchema } from '../recipient-router/schema';
import type { TrpcRouteMeta } from '../trpc';
import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from './schema';

export const createDocumentFormDataMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/document/create/formdata',
    contentTypes: ['multipart/form-data'],
    summary: 'Create document',
    description: 'Create a document using form data.',
    tags: ['Document'],
  },
};

const ZCreateDocumentFormDataPayloadRequestSchema = z.object({
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

// !: Can't use zfd.formData() here because it receives `undefined`
// !: somewhere in the pipeline of our openapi schema generation and throws
// !: an error.
export const ZCreateDocumentFormDataRequestSchema = zodFormData({
  payload: zfd.json(ZCreateDocumentFormDataPayloadRequestSchema),
  file: zfd.file(),
});

export const ZCreateDocumentFormDataResponseSchema = z.object({
  document: ZDocumentSchema,
});

export type TCreateDocumentFormDataRequest = z.infer<typeof ZCreateDocumentFormDataRequestSchema>;
export type TCreateDocumentFormDataResponse = z.infer<typeof ZCreateDocumentFormDataResponseSchema>;
