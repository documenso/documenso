import { z } from 'zod';

import {
  ZRecipientAccessAuthTypesSchema,
  ZRecipientActionAuthSchema,
  ZRecipientActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { RecipientRole } from '@documenso/prisma/client';
import { FieldSchema, RecipientSchema } from '@documenso/prisma/generated/zod';

export const ZGetRecipientQuerySchema = z.object({
  recipientId: z.number(),
});

const ZCreateRecipientSchema = z.object({
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

/**
 * Use this when returning base recipients from the API.
 */
export const ZRecipientBaseResponseSchema = RecipientSchema.pick({
  id: true,
  documentId: true,
  templateId: true,
  email: true,
  name: true,
  token: true,
  documentDeletedAt: true,
  expired: true,
  signedAt: true,
  authOptions: true,
  signingOrder: true,
  rejectionReason: true,
  role: true,
  readStatus: true,
  signingStatus: true,
  sendStatus: true,
});

/**
 * Use this when returning a full recipient from the API.
 */
export const ZRecipientResponseSchema = ZRecipientBaseResponseSchema.extend({
  fields: FieldSchema.array(),
});

export const ZCreateDocumentRecipientRequestSchema = z.object({
  documentId: z.number(),
  recipient: ZCreateRecipientSchema,
});

export const ZCreateDocumentRecipientResponseSchema = ZRecipientBaseResponseSchema;

export const ZCreateDocumentRecipientsRequestSchema = z.object({
  documentId: z.number(),
  recipients: z.array(ZCreateRecipientSchema).refine((recipients) => {
    const emails = recipients.map((recipient) => recipient.email.toLowerCase());

    return new Set(emails).size === emails.length;
  }),
});

export const ZUpdateDocumentRecipientRequestSchema = z.object({
  documentId: z.number(),
  recipient: ZUpdateRecipientSchema,
});

export const ZUpdateDocumentRecipientResponseSchema = ZRecipientResponseSchema;

export const ZUpdateDocumentRecipientsRequestSchema = z.object({
  documentId: z.number(),
  recipients: z.array(ZUpdateRecipientSchema).refine((recipients) => {
    const emails = recipients
      .filter((recipient) => recipient.email !== undefined)
      .map((recipient) => recipient.email?.toLowerCase());

    return new Set(emails).size === emails.length;
  }),
});

export const ZUpdateDocumentRecipientsResponseSchema = z.object({
  recipients: z.array(ZRecipientResponseSchema),
});

export const ZDeleteDocumentRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZSetDocumentRecipientsRequestSchema = z
  .object({
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
  })
  .refine(
    (schema) => {
      const emails = schema.recipients.map((recipient) => recipient.email.toLowerCase());

      return new Set(emails).size === emails.length;
    },
    // Dirty hack to handle errors when .root is populated for an array type
    { message: 'Signers must have unique emails', path: ['signers__root'] },
  );

export const ZCreateTemplateRecipientRequestSchema = z.object({
  templateId: z.number(),
  recipient: ZCreateRecipientSchema,
});

export const ZCreateTemplateRecipientResponseSchema = ZRecipientBaseResponseSchema;

export const ZCreateTemplateRecipientsRequestSchema = z.object({
  templateId: z.number(),
  recipients: z.array(ZCreateRecipientSchema).refine((recipients) => {
    const emails = recipients.map((recipient) => recipient.email);

    return new Set(emails).size === emails.length;
  }),
});

export const ZUpdateTemplateRecipientRequestSchema = z.object({
  templateId: z.number(),
  recipient: ZUpdateRecipientSchema,
});

export const ZUpdateTemplateRecipientResponseSchema = ZRecipientResponseSchema;

export const ZUpdateTemplateRecipientsRequestSchema = z.object({
  templateId: z.number(),
  recipients: z.array(ZUpdateRecipientSchema).refine((recipients) => {
    const emails = recipients
      .filter((recipient) => recipient.email !== undefined)
      .map((recipient) => recipient.email);

    return new Set(emails).size === emails.length;
  }),
});

export const ZUpdateTemplateRecipientsResponseSchema = z.object({
  recipients: z.array(ZRecipientResponseSchema).refine((recipients) => {
    const emails = recipients.map((recipient) => recipient.email);

    return new Set(emails).size === emails.length;
  }),
});

export const ZDeleteTemplateRecipientRequestSchema = z.object({
  recipientId: z.number(),
});

export const ZSetTemplateRecipientsRequestSchema = z
  .object({
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
  })
  .refine(
    (schema) => {
      const emails = schema.recipients.map((recipient) => recipient.email);

      return new Set(emails).size === emails.length;
    },
    // Dirty hack to handle errors when .root is populated for an array type
    { message: 'Recipients must have unique emails', path: ['recipients__root'] },
  );

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

/**
 * Legacy schema. Remove after deployment (when addSigners trpc is removed).
 *
 * @deprecated
 */
export const ZAddSignersMutationSchema = z
  .object({
    documentId: z.number(),
    signers: z.array(
      z.object({
        nativeId: z.number().optional(),
        email: z.string().toLowerCase().email().min(1),
        name: z.string(),
        role: z.nativeEnum(RecipientRole),
        signingOrder: z.number().optional(),
        actionAuth: ZRecipientActionAuthTypesSchema.optional().nullable(),
      }),
    ),
  })
  .refine(
    (schema) => {
      const emails = schema.signers.map((signer) => signer.email.toLowerCase());

      return new Set(emails).size === emails.length;
    },
    // Dirty hack to handle errors when .root is populated for an array type
    { message: 'Signers must have unique emails', path: ['signers__root'] },
  );
