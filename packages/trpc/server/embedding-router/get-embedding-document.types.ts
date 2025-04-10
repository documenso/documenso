import { DocumentDataType, type Field, type Recipient } from '@prisma/client';
import { z } from 'zod';

export const ZGetEmbeddingDocumentRequestSchema = z.object({
  documentId: z.number(),
});

export const ZGetEmbeddingDocumentResponseSchema = z.object({
  document: z
    .object({
      id: z.number(),
      title: z.string(),
      status: z.string(),
      documentDataId: z.string(),
      userId: z.number(),
      teamId: z.number().nullable(),
      createdAt: z.date(),
      updatedAt: z.date(),
      documentData: z.object({
        id: z.string(),
        type: z.nativeEnum(DocumentDataType),
        data: z.string(),
        initialData: z.string(),
      }),
      recipients: z.array(z.custom<Recipient>()),
      fields: z.array(z.custom<Field>()),
    })
    .nullable(),
});

export type TGetEmbeddingDocumentRequestSchema = z.infer<typeof ZGetEmbeddingDocumentRequestSchema>;
export type TGetEmbeddingDocumentResponseSchema = z.infer<
  typeof ZGetEmbeddingDocumentResponseSchema
>;
