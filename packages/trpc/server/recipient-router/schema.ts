import { z } from 'zod';

import {
  ZRecipientAccessAuthTypesSchema,
  ZRecipientActionAuthSchema,
  ZRecipientActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZRecipientLiteSchema, ZRecipientSchema } from '@documenso/lib/types/recipient';
import { RecipientRole } from '@documenso/prisma/client';

export const ZGetRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZGetRecipientResponseSchema = ZRecipientSchema;

/**
 * When changing this, ensure everything that uses this schema is updated correctly
 * since this will change the Openapi schema.
 *
 * Example `createDocument` uses this, so you will need to update that function to
 * pass along required details.
 */
export const ZCreateRecipientSchema = z.object({
  email: z.string().toLowerCase().email().min(1),
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
  signingOrder: z.number().optional(),
  accessAuth: ZRecipientAccessAuthTypesSchema.optional().nullable(),
  actionAuth: ZRecipientActionAuthTypesSchema.optional().nullable(),
});

const ZUpdateRecipientSchema = z.object({
  id: z.number().describe('The ID of the recipient to update.'),
  email: z.string().toLowerCase().email().min(1).optional(),
  name: z.string().optional(),
  role: z.nativeEnum(RecipientRole).optional(),
  signingOrder: z.number().optional(),
  accessAuth: ZRecipientAccessAuthTypesSchema.optional().nullable(),
  actionAuth: ZRecipientActionAuthTypesSchema.optional().nullable(),
});

export const ZCreateDocumentRecipientRequestSchema = z.object({
  documentId: z.number(),
  recipient: ZCreateRecipientSchema,
});

export const ZCreateDocumentRecipientResponseSchema = ZRecipientLiteSchema;

export const ZCreateDocumentRecipientsRequestSchema = z.object({
  documentId: z.number(),
  recipients: z.array(ZCreateRecipientSchema),
});

export const ZCreateDocumentRecipientsResponseSchema = z.object({
  recipients: ZRecipientLiteSchema.array(),
});

export const ZUpdateDocumentRecipientRequestSchema = z.object({
  documentId: z.number(),
  recipient: ZUpdateRecipientSchema,
});

export const ZUpdateDocumentRecipientResponseSchema = ZRecipientSchema;

export const ZUpdateDocumentRecipientsRequestSchema = z.object({
  documentId: z.number(),
  recipients: z.array(ZUpdateRecipientSchema),
});

export const ZUpdateDocumentRecipientsResponseSchema = z.object({
  recipients: z.array(ZRecipientSchema),
});

export const ZDeleteDocumentRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZSetDocumentRecipientsRequestSchema = z.object({
  documentId: z.number(),
  recipients: z.array(
    z.object({
      nativeId: z.number().optional(),
      email: z.string().toLowerCase().email().min(1),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
      actionAuth: ZRecipientActionAuthTypesSchema.optional().nullable(),
    }),
  ),
});

export const ZSetDocumentRecipientsResponseSchema = z.object({
  recipients: ZRecipientLiteSchema.array(),
});

export const ZCreateTemplateRecipientRequestSchema = z.object({
  templateId: z.number(),
  recipient: ZCreateRecipientSchema,
});

export const ZCreateTemplateRecipientResponseSchema = ZRecipientLiteSchema;

export const ZCreateTemplateRecipientsRequestSchema = z.object({
  templateId: z.number(),
  recipients: z.array(ZCreateRecipientSchema),
});

export const ZCreateTemplateRecipientsResponseSchema = z.object({
  recipients: ZRecipientLiteSchema.array(),
});

export const ZUpdateTemplateRecipientRequestSchema = z.object({
  templateId: z.number(),
  recipient: ZUpdateRecipientSchema,
});

export const ZUpdateTemplateRecipientResponseSchema = ZRecipientSchema;

export const ZUpdateTemplateRecipientsRequestSchema = z.object({
  templateId: z.number(),
  recipients: z.array(ZUpdateRecipientSchema),
});

export const ZUpdateTemplateRecipientsResponseSchema = z.object({
  recipients: z.array(ZRecipientSchema),
});

export const ZDeleteTemplateRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZSetTemplateRecipientsRequestSchema = z.object({
  templateId: z.number(),
  recipients: z.array(
    z.object({
      nativeId: z.number().optional(),
      email: z.string().toLowerCase().email().min(1),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
      actionAuth: ZRecipientActionAuthTypesSchema.optional().nullable(),
    }),
  ),
});

export const ZSetTemplateRecipientsResponseSchema = z.object({
  recipients: ZRecipientLiteSchema.array(),
});

export const ZCompleteDocumentWithTokenMutationSchema = z.object({
  token: z.string(),
  documentId: z.number(),
  authOptions: ZRecipientActionAuthSchema.optional(),
});

export type TCompleteDocumentWithTokenMutationSchema = z.infer<
  typeof ZCompleteDocumentWithTokenMutationSchema
>;

export const ZRejectDocumentWithTokenMutationSchema = z.object({
  token: z.string(),
  documentId: z.number(),
  reason: z.string(),
  authOptions: ZRecipientActionAuthSchema.optional(),
});

export type TRejectDocumentWithTokenMutationSchema = z.infer<
  typeof ZRejectDocumentWithTokenMutationSchema
>;
