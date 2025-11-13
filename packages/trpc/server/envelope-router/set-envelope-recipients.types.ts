import { EnvelopeType, RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { ZRecipientLiteSchema } from '@documenso/lib/types/recipient';

export const ZSetEnvelopeRecipientsRequestSchema = z.object({
  envelopeId: z.string(),
  envelopeType: z.nativeEnum(EnvelopeType),
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

export const ZSetEnvelopeRecipientsResponseSchema = z.object({
  data: ZRecipientLiteSchema.omit({
    documentId: true,
    templateId: true,
  }).array(),
});

export type TSetEnvelopeRecipientsRequest = z.infer<typeof ZSetEnvelopeRecipientsRequestSchema>;
export type TSetEnvelopeRecipientsResponse = z.infer<typeof ZSetEnvelopeRecipientsResponseSchema>;
