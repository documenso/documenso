import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { isTemplateRecipientEmailPlaceholder } from '@documenso/lib/constants/template';
import {
  ZRecipientAccessAuthSchema,
  ZRecipientAccessAuthTypesSchema,
  ZRecipientActionAuthSchema,
  ZRecipientActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZRecipientLiteSchema, ZRecipientSchema } from '@documenso/lib/types/recipient';

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
  email: z.string().toLowerCase().email().min(1).max(254),
  name: z.string().max(255),
  role: z.nativeEnum(RecipientRole),
  signingOrder: z.number().optional(),
  accessAuth: z.array(ZRecipientAccessAuthTypesSchema).default([]).optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).default([]).optional(),
});

export const ZUpdateRecipientSchema = z.object({
  id: z.number().describe('The ID of the recipient to update.'),
  email: z.string().toLowerCase().email().min(1).max(254).optional(),
  name: z.string().max(255).optional(),
  role: z.nativeEnum(RecipientRole).optional(),
  signingOrder: z.number().optional(),
  accessAuth: z.array(ZRecipientAccessAuthTypesSchema).default([]).optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).default([]).optional(),
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
      id: z.number().optional(),
      email: z.string().toLowerCase().email().min(1).max(254),
      name: z.string().max(255),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
      actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
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
      id: z.number().optional(),
      email: z
        .string()
        .toLowerCase()
        .refine(
          (email) => {
            return (
              isTemplateRecipientEmailPlaceholder(email) ||
              z.string().email().safeParse(email).success
            );
          },
          { message: 'Please enter a valid email address' },
        ),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
      actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
    }),
  ),
});

export const ZSetTemplateRecipientsResponseSchema = z.object({
  recipients: ZRecipientLiteSchema.array(),
});

export const ZCompleteDocumentWithTokenMutationSchema = z.object({
  token: z.string(),
  documentId: z.number(),
  accessAuthOptions: ZRecipientAccessAuthSchema.optional(),
  nextSigner: z
    .object({
      email: z.string().email().max(254),
      name: z.string().min(1).max(255),
    })
    .optional(),
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
