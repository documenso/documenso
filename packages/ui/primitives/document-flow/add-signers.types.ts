import { msg } from '@lingui/macro';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';

import { ZMapNegativeOneToUndefinedSchema } from './add-settings.types';
import { DocumentSigningOrder, RecipientRole } from '.prisma/client';

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
      actionAuth: ZMapNegativeOneToUndefinedSchema.pipe(ZRecipientActionAuthTypesSchema.optional()),
    }),
  ),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
});

export type TAddSignersFormSchema = z.infer<typeof ZAddSignersFormSchema>;
