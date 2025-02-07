import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { DocumentSigningOrder, RecipientRole } from '@documenso/prisma/client';

import { ZMapNegativeOneToUndefinedSchema } from '../document-flow/add-settings.types';

export const ZAddTemplatePlacholderRecipientsFormSchema = z.object({
  signers: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      email: z.string().min(1).email(),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
      signerIndex: z.number().min(0),
      actionAuth: ZMapNegativeOneToUndefinedSchema.pipe(ZRecipientActionAuthTypesSchema.optional()),
    }),
  ),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
});

export type TAddTemplatePlacholderRecipientsFormSchema = z.infer<
  typeof ZAddTemplatePlacholderRecipientsFormSchema
>;
