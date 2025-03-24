import { FieldType } from '@prisma/client';
import { z } from 'zod';

import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

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
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export type TAddTemplateFieldsFormSchema = z.infer<typeof ZAddTemplateFieldsFormSchema>;
