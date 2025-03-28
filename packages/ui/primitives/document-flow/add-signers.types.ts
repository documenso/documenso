import { msg } from '@lingui/core/macro';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';

import { ZMapNegativeOneToUndefinedSchema } from './add-settings.types';

export const ZAddSignersFormSchema = z
  .object({
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
        actionAuth: ZMapNegativeOneToUndefinedSchema.pipe(
          ZRecipientActionAuthTypesSchema.optional(),
        ),
      }),
    ),
    signingOrder: z.nativeEnum(DocumentSigningOrder),
    allowDictateNextSigner: z.boolean().default(false),
  })
  .refine(
    (schema) => {
      const emails = schema.signers.map((signer) => signer.email.toLowerCase());

      return new Set(emails).size === emails.length;
    },
    // Dirty hack to handle errors when .root is populated for an array type
    { message: msg`Signers must have unique emails`.id, path: ['signers__root'] },
  );

export type TAddSignersFormSchema = z.infer<typeof ZAddSignersFormSchema>;
