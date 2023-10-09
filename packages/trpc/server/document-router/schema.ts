import { z } from 'zod';

import { FieldType } from '@documenso/prisma/client';

export const ZGetDocumentByIdQuerySchema = z.object({
  id: z.number().min(1),
});

export type TGetDocumentByIdQuerySchema = z.infer<typeof ZGetDocumentByIdQuerySchema>;

export const ZGetDocumentByTokenQuerySchema = z.object({
  token: z.string().min(1),
});

export type TGetDocumentByTokenQuerySchema = z.infer<typeof ZGetDocumentByTokenQuerySchema>;

export const ZCreateDocumentMutationSchema = z.object({
  title: z.string().min(1),
  documentDataId: z.string().min(1),
});

export type TCreateDocumentMutationSchema = z.infer<typeof ZCreateDocumentMutationSchema>;

export const ZSetRecipientsForDocumentMutationSchema = z.object({
  documentId: z.number(),
  recipients: z.array(
    z.object({
      id: z.number().nullish(),
      email: z.string().min(1).email(),
      name: z.string(),
    }),
  ),
});

export type TSetRecipientsForDocumentMutationSchema = z.infer<
  typeof ZSetRecipientsForDocumentMutationSchema
>;

export const ZSetFieldsForDocumentMutationSchema = z.object({
  documentId: z.number(),
  fields: z.array(
    z.object({
      id: z.number().nullish(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
    }),
  ),
});

export type TSetFieldsForDocumentMutationSchema = z.infer<
  typeof ZSetFieldsForDocumentMutationSchema
>;

export const ZSendDocumentMutationSchema = z.object({
  documentId: z.number(),
});

export type TSendDocumentMutationSchema = z.infer<typeof ZSendDocumentMutationSchema>;

export const ZDeleteDraftDocumentMutationSchema = z.object({
  id: z.number().min(1),
});

export type TDeleteDraftDocumentMutationSchema = z.infer<typeof ZDeleteDraftDocumentMutationSchema>;
