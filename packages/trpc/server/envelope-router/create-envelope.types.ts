import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';

import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentFormValuesSchema } from '@documenso/lib/types/document-form-values';
import { ZDocumentMetaCreateSchema } from '@documenso/lib/types/document-meta';

import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from '../document-router/schema';
import { ZCreateRecipientSchema } from '../recipient-router/schema';

// Currently not in use until we allow passthrough documents on create.
// export const createEnvelopeMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/create',
//     summary: 'Create envelope',
//     tags: ['Envelope'],
//   },
// };

export const ZCreateEnvelopeRequestSchema = z.object({
  title: ZDocumentTitleSchema,
  type: z.nativeEnum(EnvelopeType),
  externalId: ZDocumentExternalIdSchema.optional(),
  visibility: ZDocumentVisibilitySchema.optional(),
  globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
  globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
  formValues: ZDocumentFormValuesSchema.optional(),
  items: z
    .object({
      title: ZDocumentTitleSchema.optional(),
      documentDataId: z.string(),
    })
    .array(),
  folderId: z
    .string()
    .describe(
      'The ID of the folder to create the document in. If not provided, the document will be created in the root folder.',
    )
    .optional(),
  recipients: z
    .array(
      ZCreateRecipientSchema.extend({
        // Todo: Envelopes ?
        // fields: ZFieldAndMetaSchema.and(
        //   z.object({
        //     pageNumber: ZFieldPageNumberSchema,
        //     pageX: ZFieldPageXSchema,
        //     pageY: ZFieldPageYSchema,
        //     width: ZFieldWidthSchema,
        //     height: ZFieldHeightSchema,
        //   }),
        // )
        //   .array()
        //   .optional(),
      }),
    )
    .optional(),
  meta: ZDocumentMetaCreateSchema.optional(),
});

export const ZCreateEnvelopeResponseSchema = z.object({
  id: z.string(),
});

export type TCreateEnvelopeRequest = z.infer<typeof ZCreateEnvelopeRequestSchema>;
export type TCreateEnvelopeResponse = z.infer<typeof ZCreateEnvelopeResponseSchema>;
