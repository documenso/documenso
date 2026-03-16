import { z } from 'zod';
import { zfd } from 'zod-form-data';

import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentMetaUpdateSchema } from '@documenso/lib/types/document-meta';
import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPositionXSchema,
  ZClampedFieldPositionYSchema,
  ZClampedFieldWidthSchema,
  ZFieldPageNumberSchema,
} from '@documenso/lib/types/field';
import { ZEnvelopeFieldAndMetaSchema } from '@documenso/lib/types/field-meta';
import { EnvelopeAttachmentSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeAttachmentSchema';
import { ZSetEnvelopeRecipientSchema } from '@documenso/trpc/server/envelope-router/set-envelope-recipients.types';

import { zfdFile, zodFormData } from '../../utils/zod-form-data';
import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from '../document-router/schema';

export const ZUpdateEmbeddingEnvelopePayloadSchema = z.object({
  envelopeId: z.string(),
  data: z.object({
    title: ZDocumentTitleSchema.optional(),
    externalId: ZDocumentExternalIdSchema.nullish(),
    visibility: ZDocumentVisibilitySchema.optional(),
    globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
    globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
    folderId: z.string().nullish(),

    /**
     * The list of envelope items that are part of the envelope.
     *
     * Any missing IDs will be treated as deleting the envelope item.
     */
    envelopeItems: z
      .object({
        /**
         * This is not necesssarily a real id, it can be a temporary id for the envelope item.
         */
        id: z.string(),

        /**
         * The title of the envelope item.
         */
        title: z.string(),

        /**
         * The order of the envelope item in the envelope.
         */
        order: z.number().int().min(0),

        /**
         * The file index for items that are not yet uploaded.
         */
        index: z.number().int().min(0).optional(),

        /**
         * The file index for existing items that need their PDF replaced.
         * Only applicable to items with real IDs (not PRESIGNED_ prefix).
         */
        replaceFileIndex: z.number().int().min(0).optional(),
      })
      .refine((item) => !(item.index !== undefined && item.replaceFileIndex !== undefined), {
        message: 'Cannot provide both index and replaceFileIndex on the same envelope item',
        path: ['replaceFileIndex'],
      })
      .array(),

    /**
     * This is a set command.
     */
    recipients: ZSetEnvelopeRecipientSchema.extend({
      fields: ZEnvelopeFieldAndMetaSchema.and(
        z.object({
          id: z.number().optional(),
          page: ZFieldPageNumberSchema,
          positionX: ZClampedFieldPositionXSchema,
          positionY: ZClampedFieldPositionYSchema,
          width: ZClampedFieldWidthSchema,
          height: ZClampedFieldHeightSchema,
          envelopeItemId: z.string(),
        }),
      ).array(),
    }).array(),

    /**
     * The list of attachments for the envelope.
     *
     * This is a set command: when provided, all existing attachments are deleted
     * and replaced with the provided list.
     */
    attachments: EnvelopeAttachmentSchema.pick({
      type: true,
      label: true,
      data: true,
    })
      .extend({
        id: z.string().optional(),
      })
      .array(),
  }),

  meta: ZDocumentMetaUpdateSchema.optional(),
});

export const ZUpdateEmbeddingEnvelopeRequestSchema = zodFormData({
  payload: zfd.json(ZUpdateEmbeddingEnvelopePayloadSchema),
  files: zfd.repeatableOfType(zfdFile()),
});

export const ZUpdateEmbeddingEnvelopeResponseSchema = z.void();

export type TUpdateEmbeddingEnvelopePayload = z.infer<typeof ZUpdateEmbeddingEnvelopePayloadSchema>;
export type TUpdateEmbeddingEnvelopeRequest = z.infer<typeof ZUpdateEmbeddingEnvelopeRequestSchema>;
