import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import {
  ZRecipientEmailSchema,
  ZRecipientLiteSchema,
  ZRecipientSigningOrderSchema,
} from '@documenso/lib/types/recipient';
import { EnvelopeType, RecipientRole } from '@prisma/client';
import { z } from 'zod';

export const ZSetEnvelopeRecipientSchema = z.object({
  id: z.number().optional(),
  clientId: z
    .string()
    .optional()
    .describe('A temporary ID echoed back on the response so newly created recipients can be reconciled'),
  email: ZRecipientEmailSchema,
  name: z.string().max(255),
  role: z.nativeEnum(RecipientRole),
  signingOrder: ZRecipientSigningOrderSchema.optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
});

export const ZSetEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
  recipients: ZSetEnvelopeRecipientSchema.array(),
});

export const ZSetEnvelopeRecipientsResponseSchema = z.object({
  data: ZRecipientLiteSchema.omit({
    documentId: true,
    templateId: true,
  })
    .extend({
      clientId: z.string().nullish(),
    })
    .array(),
});

export type TSetEnvelopeRecipientsRequest = z.infer<typeof ZSetEnvelopeRecipientsRequestSchema>;
export type TSetEnvelopeRecipientsResponse = z.infer<typeof ZSetEnvelopeRecipientsResponseSchema>;
