import { z } from 'zod';

import { FieldType } from '@documenso/prisma/client';

export const GetDocumentsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
});

export const DeleteDocumentMutationSchema = z.string();

export const SuccessfulDocumentResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  status: z.string(),
  documentDataId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
});

export const SendDocumentForSigningMutationSchema = z.object({
  signerEmail: z.string(),
  signerName: z.string().optional(),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
  fields: z.array(
    z.object({
      fieldType: z.nativeEnum(FieldType),
      pageNumber: z.number(),
      pageX: z.number(),
      pageY: z.number(),
      pageWidth: z.number(),
      pageHeight: z.number(),
    }),
  ),
});

export const UploadDocumentSuccessfulSchema = z.object({
  url: z.string(),
  key: z.string(),
});

export const CreateDocumentMutationSchema = z.object({
  fileName: z.string(),
  contentType: z.string().default('PDF'),
});

export const SuccessfulResponseSchema = z.object({
  documents: SuccessfulDocumentResponseSchema.array(),
  totalPages: z.number(),
});

export const SuccessfulSigningResponseSchema = z.object({
  message: z.string(),
});

export const UnsuccessfulResponseSchema = z.object({
  message: z.string(),
});

export const AuthorizationHeadersSchema = z.object({
  authorization: z.string(),
});
