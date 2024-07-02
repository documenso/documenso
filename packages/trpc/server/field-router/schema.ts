import { z } from 'zod';

import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { FieldType } from '@documenso/prisma/client';

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
  teamId: z.number().optional(),
});

export type TGetFieldQuerySchema = z.infer<typeof ZGetFieldQuerySchema>;

export const ZUpdateFieldMutationSchema = z.object({
  fieldId: z.number(),
  documentId: z.number(),
  fieldMeta: ZFieldMetaSchema,
  teamId: z.number().optional(),
});
