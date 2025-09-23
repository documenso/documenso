import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';

export const ZAddTemplatePlacholderRecipientsFormSchema = z
  .object({
    signers: z.array(
      z.object({
        formId: z.string().min(1),
        nativeId: z.number().optional(),
        email: z.string().min(1).email(),
        name: z.string().min(1, { message: 'Name is required' }),
        role: z.nativeEnum(RecipientRole),
        signingOrder: z.number().optional(),
        actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
      }),
    ),
    signingOrder: z.nativeEnum(DocumentSigningOrder),
    allowDictateNextSigner: z.boolean().default(false),
  })

  .refine(
    /*
      Since placeholder emails are empty, we need to check that the names are unique.
      If we don't do this, the app will add duplicate signers and merge them in the next step, where you add fields.
    */
    (schema) => {
      const names = schema.signers.map((signer) => signer.name.trim());
      return new Set(names).size === names.length;
    },
    { message: 'Signers must have unique names', path: ['signers__root'] },
  );

export type TAddTemplatePlacholderRecipientsFormSchema = z.infer<
  typeof ZAddTemplatePlacholderRecipientsFormSchema
>;
