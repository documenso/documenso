import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentFormValuesSchema } from '@documenso/lib/types/document-form-values';
import { ZDocumentMetaCreateSchema } from '@documenso/lib/types/document-meta';
import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';
import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPositionXSchema,
  ZClampedFieldPositionYSchema,
  ZClampedFieldWidthSchema,
  ZFieldPageNumberSchema,
} from '@documenso/lib/types/field';
import { ZEnvelopeFieldAndMetaSchema } from '@documenso/lib/types/field-meta';

import { zodFormData } from '../../utils/zod-form-data';
import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from '../document-router/schema';
import { ZCreateRecipientSchema } from '../recipient-router/schema';
import type { TrpcRouteMeta } from '../trpc';

export const createEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/create',
    contentTypes: ['multipart/form-data'],
    summary: 'Create envelope',
    description: 'Create an envelope using form data.',
    tags: ['Envelope'],
  },
};

export const ZCreateEnvelopePayloadSchema = z.object({
  title: ZDocumentTitleSchema,
  type: z.nativeEnum(EnvelopeType),
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
        fields: ZEnvelopeFieldAndMetaSchema.and(
          z.object({
            identifier: z
              .union([z.string(), z.number()])
              .describe(
                'Either the filename or the index of the file that was uploaded to attach the field to.',
              )
              .optional(),
            page: ZFieldPageNumberSchema,
            positionX: ZClampedFieldPositionXSchema,
            positionY: ZClampedFieldPositionYSchema,
            width: ZClampedFieldWidthSchema,
            height: ZClampedFieldHeightSchema,
          }),
        )
          .array()
          .optional(),
      }),
    )
    .optional(),
  meta: ZDocumentMetaCreateSchema.optional(),
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

export const ZCreateEnvelopeRequestSchema = zodFormData({
  payload: zfd.json(ZCreateEnvelopePayloadSchema),
  files: zfd.repeatableOfType(zfd.file()),
});

export const ZCreateEnvelopeResponseSchema = z.object({
  id: z.string(),
});

export type TCreateEnvelopePayload = z.infer<typeof ZCreateEnvelopePayloadSchema>;
export type TCreateEnvelopeRequest = z.infer<typeof ZCreateEnvelopeRequestSchema>;
export type TCreateEnvelopeResponse = z.infer<typeof ZCreateEnvelopeResponseSchema>;
