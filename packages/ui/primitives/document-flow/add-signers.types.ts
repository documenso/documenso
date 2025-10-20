import { msg } from '@lingui/core/macro';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import {
  ZDocumentExpiryAmountSchema,
  ZDocumentExpiryUnitSchema,
} from '@documenso/lib/types/document-meta';

export const ZAddSignersFormSchema = z.object({
  signers: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      email: z
        .string()
        .email({ message: msg`Invalid email`.id })
        .min(1),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
      actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
    }),
  ),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
  allowDictateNextSigner: z.boolean().default(false),
  meta: z.object({
    expiryAmount: ZDocumentExpiryAmountSchema.optional(),
    expiryUnit: ZDocumentExpiryUnitSchema.optional(),
  }),
});

export type TAddSignersFormSchema = z.infer<typeof ZAddSignersFormSchema>;
