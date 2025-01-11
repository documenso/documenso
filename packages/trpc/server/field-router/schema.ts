import { z } from 'zod';

import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { FieldType } from '@documenso/prisma/client';
import { FieldSchema } from '@documenso/prisma/generated/zod';

const ZCreateFieldSchema = z.object({
  recipientId: z.number().describe('The ID of the recipient to create the field for.'),
  type: FieldSchema.shape.type.describe('The type of the field to create.'),
  pageNumber: z.number().describe('The page number the field will be on.'),
  pageX: z.number().describe('The X coordinate of where the field will be placed.'),
  pageY: z.number().describe('The Y coordinate of where the field will be placed.'),
  width: z.number().describe('The width of the field.'),
  height: z.number().describe('The height of the field.'),
  fieldMeta: ZFieldMetaSchema.optional(),
});

const ZUpdateFieldSchema = z.object({
  id: z.number().describe('The ID of the field to update.'),
  type: FieldSchema.shape.type.optional().describe('The type of the field to update.'),
  pageNumber: z.number().optional().describe('The page number the field will be on.'),
  pageX: z.number().optional().describe('The X coordinate of where the field will be placed.'),
  pageY: z.number().optional().describe('The Y coordinate of where the field will be placed.'),
  width: z.number().optional().describe('The width of the field.'),
  height: z.number().optional().describe('The height of the field.'),
  fieldMeta: ZFieldMetaSchema.optional(),
});

export const ZCreateDocumentFieldRequestSchema = z.object({
  documentId: z.number().min(1),
  field: ZCreateFieldSchema,
});

export const ZCreateDocumentFieldsRequestSchema = z.object({
  documentId: z.number().min(1),
  fields: ZCreateFieldSchema.array(),
});

export const ZUpdateDocumentFieldRequestSchema = z.object({
  documentId: z.number().min(1),
  field: ZUpdateFieldSchema,
});

export const ZUpdateDocumentFieldsRequestSchema = z.object({
  documentId: z.number().min(1),
  fields: ZUpdateFieldSchema.array(),
});

export const ZDeleteDocumentFieldRequestSchema = z.object({
  fieldId: z.number().min(1),
});

export const ZCreateTemplateFieldRequestSchema = z.object({
  templateId: z.number().min(1),
  field: ZCreateFieldSchema,
});

export const ZCreateDocumentFieldResponseSchema = FieldSchema;
export const ZUpdateTemplateFieldResponseSchema = FieldSchema;
export const ZUpdateDocumentFieldResponseSchema = FieldSchema;
export const ZCreateTemplateFieldResponseSchema = FieldSchema;

export const ZCreateTemplateFieldsRequestSchema = z.object({
  templateId: z.number().min(1),
  fields: ZCreateFieldSchema.array(),
});

export const ZUpdateTemplateFieldRequestSchema = z.object({
  templateId: z.number().min(1),
  field: ZUpdateFieldSchema,
});

export const ZUpdateTemplateFieldsRequestSchema = z.object({
  templateId: z.number().min(1),
  fields: ZUpdateFieldSchema.array(),
});

export const ZDeleteTemplateFieldRequestSchema = z.object({
  fieldId: z.number().min(1),
});

export const ZAddFieldsMutationSchema = z.object({
  documentId: z.number(),
  fields: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export type TAddFieldsMutationSchema = z.infer<typeof ZAddFieldsMutationSchema>;

export const ZAddTemplateFieldsMutationSchema = z.object({
  templateId: z.number(),
  fields: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export type TAddTemplateFieldsMutationSchema = z.infer<typeof ZAddTemplateFieldsMutationSchema>;

export const ZSignFieldWithTokenMutationSchema = z.object({
  token: z.string(),
  fieldId: z.number(),
  value: z.string().trim(),
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

export const ZGetFieldQuerySchema = z.object({
  fieldId: z.number(),
});

export type TGetFieldQuerySchema = z.infer<typeof ZGetFieldQuerySchema>;

export const ZUpdateFieldMutationSchema = z.object({
  fieldId: z.number(),
  documentId: z.number(),
  fieldMeta: ZFieldMetaSchema,
  teamId: z.number().optional(),
});
