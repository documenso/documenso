import { z } from 'zod';

import { FieldType } from '@documenso/prisma/client';

export const ZAddTemplateFieldsFormSchema = z.object({
  fields: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1),
      signerToken: z.string(),
      signerId: z.number().optional(),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
    }),
  ),
});

export type TAddTemplateFieldsFormSchema = z.infer<typeof ZAddTemplateFieldsFormSchema>;
