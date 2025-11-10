import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { ZDocumentMetaTimezoneSchema } from '@documenso/lib/types/document-meta';
import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';

import { zodFormData } from '../../utils/zod-form-data';
import type { TrpcRouteMeta } from '../trpc';
import { ZDocumentTitleSchema } from './schema';

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
  timezone: ZDocumentMetaTimezoneSchema.optional(),
  folderId: z.string().describe('The ID of the folder to create the document in').optional(),
  attachments: z
    .array(
      z.object({
        label: z.string().min(1, 'Label is required'),
        data: z.string().url('Must be a valid URL'),
        type: ZEnvelopeAttachmentTypeSchema.optional().default('link'),
      }),
    )
    .optional(),
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
