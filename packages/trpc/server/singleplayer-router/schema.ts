import { z } from 'zod';

import { DocumentDataType, FieldType } from '@documenso/prisma/client';

export const ZCreateSinglePlayerDocumentMutationSchema = z.object({
  documentData: z.object({
    data: z.string(),
    type: z.nativeEnum(DocumentDataType),
  }),
  documentName: z.string(),
  signer: z.object({
    email: z.string().email().min(1),
    name: z.string(),
    signature: z.string(),
    customText: z.string(),
  }),
  fields: z.array(
    z.object({
      page: z.number(),
      type: z.nativeEnum(FieldType),
      positionX: z.number(),
      positionY: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  ),
});

export type TCreateSinglePlayerDocumentMutationSchema = z.infer<
  typeof ZCreateSinglePlayerDocumentMutationSchema
>;
