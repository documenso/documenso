import { FieldType } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import {
  ZFieldHeightSchema,
  ZFieldPageNumberSchema,
  ZFieldPageXSchema,
  ZFieldPageYSchema,
  ZFieldSchema,
  ZFieldWidthSchema,
} from '@documenso/lib/types/field';
import { ZFieldAndMetaSchema, ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

const ZCreateFieldSchema = ZFieldAndMetaSchema.and(
  z.object({
    recipientId: z.number().describe('The ID of the recipient to create the field for.'),
    pageNumber: ZFieldPageNumberSchema,
    pageX: ZFieldPageXSchema,
    pageY: ZFieldPageYSchema,
    width: ZFieldWidthSchema,
    height: ZFieldHeightSchema,
  }),
);

const ZUpdateFieldSchema = ZFieldAndMetaSchema.and(
  z.object({
    id: z.number().describe('The ID of the field to update.'),
    pageNumber: ZFieldPageNumberSchema.optional(),
    pageX: ZFieldPageXSchema.optional(),
    pageY: ZFieldPageYSchema.optional(),
    width: ZFieldWidthSchema.optional(),
    height: ZFieldHeightSchema.optional(),
  }),
);

export const ZCreateDocumentFieldRequestSchema = z.object({
  documentId: z.number(),
  field: ZCreateFieldSchema,
});

export const ZCreateDocumentFieldResponseSchema = ZFieldSchema;

export const ZCreateDocumentFieldsRequestSchema = z.object({
  documentId: z.number(),
  fields: ZCreateFieldSchema.array(),
});

export const ZCreateDocumentFieldsResponseSchema = z.object({
  fields: z.array(ZFieldSchema),
});

export const ZUpdateDocumentFieldRequestSchema = z.object({
  documentId: z.number(),
  field: ZUpdateFieldSchema,
});

export const ZUpdateDocumentFieldResponseSchema = ZFieldSchema;

export const ZUpdateDocumentFieldsRequestSchema = z.object({
  documentId: z.number(),
  fields: ZUpdateFieldSchema.array(),
});

export const ZUpdateDocumentFieldsResponseSchema = z.object({
  fields: z.array(ZFieldSchema),
});

export const ZDeleteDocumentFieldRequestSchema = z.object({
  fieldId: z.number(),
});

export const ZCreateTemplateFieldRequestSchema = z.object({
  templateId: z.number(),
  field: ZCreateFieldSchema,
});

export const ZCreateTemplateFieldResponseSchema = ZFieldSchema;

export const ZCreateTemplateFieldsRequestSchema = z.object({
  templateId: z.number(),
  fields: ZCreateFieldSchema.array(),
});

export const ZCreateTemplateFieldsResponseSchema = z.object({
  fields: z.array(ZFieldSchema),
});

export const ZUpdateTemplateFieldRequestSchema = z.object({
  templateId: z.number(),
  field: ZUpdateFieldSchema,
});

export const ZUpdateTemplateFieldsRequestSchema = z.object({
  templateId: z.number(),
  fields: ZUpdateFieldSchema.array(),
});

export const ZUpdateTemplateFieldsResponseSchema = z.object({
  fields: z.array(ZFieldSchema),
});

export const ZUpdateTemplateFieldResponseSchema = ZFieldSchema;

export const ZDeleteTemplateFieldRequestSchema = z.object({
  fieldId: z.number(),
});

export const ZSetDocumentFieldsRequestSchema = z.object({
  documentId: z.number(),
  fields: z.array(
    z.object({
      id: z.number().optional(),
      type: z.nativeEnum(FieldType),
      recipientId: z.number().min(1),
      envelopeItemId: z.string(),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export const ZSetDocumentFieldsResponseSchema = z.object({
  fields: z.array(ZFieldSchema),
});

export const ZSetFieldsForTemplateRequestSchema = z.object({
  templateId: z.number(),
  fields: z.array(
    z.object({
      id: z.number().optional(),
      type: z.nativeEnum(FieldType),
      recipientId: z.number().min(1),
      envelopeItemId: z.string(),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export const ZSetFieldsForTemplateResponseSchema = z.object({
  fields: z.array(ZFieldSchema),
});

export const ZSignFieldWithTokenMutationSchema = z.object({
  token: z.string(),
  fieldId: z.number(),
  value: z.string().trim().optional(),
  isBase64: z.boolean().optional(),
  authOptions: ZRecipientActionAuthSchema.optional(),
});

export type TSignFieldWithTokenMutationSchema = z.infer<typeof ZSignFieldWithTokenMutationSchema>;

export const ZRemovedSignedFieldWithTokenMutationSchema = z.object({
  token: z.string(),
  fieldId: z.number(),
});

export type TRemovedSignedFieldWithTokenMutationSchema = z.infer<
  typeof ZRemovedSignedFieldWithTokenMutationSchema
>;

export const ZGetFieldRequestSchema = z.object({
  fieldId: z.number(),
});

export const ZGetFieldResponseSchema = ZFieldSchema;
