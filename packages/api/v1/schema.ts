import { z } from 'zod';

import { FieldType } from '@documenso/prisma/client';

export const ZGetDocumentsQuerySchema = z.object({
  page: z.string().optional(),
  perPage: z.string().optional(),
});

export type TGetDocumentsQuerySchema = z.infer<typeof ZGetDocumentsQuerySchema>;

export const ZDeleteDocumentMutationSchema = z.string();

export type TDeleteDocumentMutationSchema = z.infer<typeof ZDeleteDocumentMutationSchema>;

export const ZSuccessfulDocumentResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  status: z.string(),
  documentDataId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
});

export type TSuccessfulDocumentResponseSchema = z.infer<typeof ZSuccessfulDocumentResponseSchema>;

export const ZSendDocumentForSigningMutationSchema = z.object({
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

export type TSendDocumentForSigningMutationSchema = z.infer<
  typeof ZSendDocumentForSigningMutationSchema
>;

export const ZUploadDocumentSuccessfulSchema = z.object({
  url: z.string(),
  key: z.string(),
});

export type TUploadDocumentSuccessfulSchema = z.infer<typeof ZUploadDocumentSuccessfulSchema>;

export const ZCreateDocumentMutationSchema = z.object({
  fileName: z.string(),
  contentType: z.string().default('PDF'),
});

export type TCreateDocumentMutationSchema = z.infer<typeof ZCreateDocumentMutationSchema>;

export const ZSuccessfulResponseSchema = z.object({
  documents: ZSuccessfulDocumentResponseSchema.array(),
  totalPages: z.number(),
});

export type TSuccessfulResponseSchema = z.infer<typeof ZSuccessfulResponseSchema>;

export const ZSuccessfulSigningResponseSchema = z.object({
  message: z.string(),
});

export type TSuccessfulSigningResponseSchema = z.infer<typeof ZSuccessfulSigningResponseSchema>;

export const ZUnsuccessfulResponseSchema = z.object({
  message: z.string(),
});

export type TUnsuccessfulResponseSchema = z.infer<typeof ZUnsuccessfulResponseSchema>;

export const ZAuthorizationHeadersSchema = z.object({
  authorization: z.string(),
});

export type TAuthorizationHeadersSchema = z.infer<typeof ZAuthorizationHeadersSchema>;
