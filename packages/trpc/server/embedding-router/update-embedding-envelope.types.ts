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
import { ZSetEnvelopeRecipientSchema } from '@documenso/trpc/server/envelope-router/set-envelope-recipients.types';

import { zodFormData } from '../../utils/zod-form-data';
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
  }),

  meta: ZDocumentMetaUpdateSchema.optional(),
});

export const ZUpdateEmbeddingEnvelopeRequestSchema = zodFormData({
  payload: zfd.json(ZUpdateEmbeddingEnvelopePayloadSchema),
  files: zfd.repeatableOfType(zfd.file()),
});

export const ZUpdateEmbeddingEnvelopeResponseSchema = z.void();

export type TUpdateEmbeddingEnvelopePayload = z.infer<typeof ZUpdateEmbeddingEnvelopePayloadSchema>;
export type TUpdateEmbeddingEnvelopeRequest = z.infer<typeof ZUpdateEmbeddingEnvelopeRequestSchema>;
