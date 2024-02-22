import { z } from 'zod';

import {
  FieldType,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';

/**
 * Documents
 */
export const ZGetDocumentsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  perPage: z.coerce.number().min(1).optional().default(1),
});

export type TGetDocumentsQuerySchema = z.infer<typeof ZGetDocumentsQuerySchema>;

export const ZDeleteDocumentMutationSchema = null;

export type TDeleteDocumentMutationSchema = typeof ZDeleteDocumentMutationSchema;

export const ZSuccessfulDocumentResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  teamId: z.number().nullish(),
  title: z.string(),
  status: z.string(),
  documentDataId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
});

export const ZSuccessfulGetDocumentResponseSchema = ZSuccessfulDocumentResponseSchema.extend({
  recipients: z.lazy(() => z.array(ZSuccessfulRecipientResponseSchema)),
});

export type TSuccessfulGetDocumentResponseSchema = z.infer<
  typeof ZSuccessfulGetDocumentResponseSchema
>;

export type TSuccessfulDocumentResponseSchema = z.infer<typeof ZSuccessfulDocumentResponseSchema>;

export const ZSendDocumentForSigningMutationSchema = null;

export type TSendDocumentForSigningMutationSchema = typeof ZSendDocumentForSigningMutationSchema;

export const ZUploadDocumentSuccessfulSchema = z.object({
  url: z.string(),
  key: z.string(),
});

export type TUploadDocumentSuccessfulSchema = z.infer<typeof ZUploadDocumentSuccessfulSchema>;

export const ZCreateDocumentMutationSchema = z.object({
  title: z.string().min(1),
  recipients: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email().min(1),
      role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
    }),
  ),
  meta: z
    .object({
      subject: z.string(),
      message: z.string(),
      timezone: z.string(),
      dateFormat: z.string(),
      redirectUrl: z.string(),
    })
    .partial(),
});

export type TCreateDocumentMutationSchema = z.infer<typeof ZCreateDocumentMutationSchema>;

export const ZCreateDocumentMutationResponseSchema = z.object({
  uploadUrl: z.string().min(1),
  documentId: z.number(),
  recipients: z.array(
    z.object({
      recipientId: z.number(),
      token: z.string(),
      role: z.nativeEnum(RecipientRole),
    }),
  ),
});

export type TCreateDocumentMutationResponseSchema = z.infer<
  typeof ZCreateDocumentMutationResponseSchema
>;

export const ZCreateDocumentFromTemplateMutationSchema = z.object({
  title: z.string().min(1),
  recipients: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().email().min(1),
      role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
    }),
  ),
  meta: z
    .object({
      subject: z.string(),
      message: z.string(),
      timezone: z.string(),
      dateFormat: z.string(),
      redirectUrl: z.string(),
    })
    .partial()
    .optional(),
});

export type TCreateDocumentFromTemplateMutationSchema = z.infer<
  typeof ZCreateDocumentFromTemplateMutationSchema
>;

export const ZCreateDocumentFromTemplateMutationResponseSchema = z.object({
  documentId: z.number(),
  recipients: z.array(
    z.object({
      recipientId: z.number(),
      name: z.string(),
      email: z.string().email().min(1),
      token: z.string(),
      role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
    }),
  ),
});

export type TCreateDocumentFromTemplateMutationResponseSchema = z.infer<
  typeof ZCreateDocumentFromTemplateMutationResponseSchema
>;

export const ZCreateRecipientMutationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().min(1),
  role: z.nativeEnum(RecipientRole).optional().default(RecipientRole.SIGNER),
});

/**
 * Recipients
 */
export type TCreateRecipientMutationSchema = z.infer<typeof ZCreateRecipientMutationSchema>;

export const ZUpdateRecipientMutationSchema = ZCreateRecipientMutationSchema.partial();

export type TUpdateRecipientMutationSchema = z.infer<typeof ZUpdateRecipientMutationSchema>;

export const ZDeleteRecipientMutationSchema = null;

export type TDeleteRecipientMutationSchema = typeof ZDeleteRecipientMutationSchema;

export const ZSuccessfulRecipientResponseSchema = z.object({
  id: z.number(),
  // !: This handles the fact that we have null documentId's for templates
  // !: while we won't need the default we must add it to satisfy typescript
  documentId: z.number().nullish().default(-1),
  email: z.string().email().min(1),
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
  token: z.string(),
  // !: Not used for now
  // expired: z.string(),
  signedAt: z.date().nullable(),
  readStatus: z.nativeEnum(ReadStatus),
  signingStatus: z.nativeEnum(SigningStatus),
  sendStatus: z.nativeEnum(SendStatus),
});

export type TSuccessfulRecipientResponseSchema = z.infer<typeof ZSuccessfulRecipientResponseSchema>;

/**
 * Fields
 */
export const ZCreateFieldMutationSchema = z.object({
  recipientId: z.number(),
  type: z.nativeEnum(FieldType),
  pageNumber: z.number(),
  pageX: z.number(),
  pageY: z.number(),
  pageWidth: z.number(),
  pageHeight: z.number(),
});

export type TCreateFieldMutationSchema = z.infer<typeof ZCreateFieldMutationSchema>;

export const ZUpdateFieldMutationSchema = ZCreateFieldMutationSchema.partial();

export type TUpdateFieldMutationSchema = z.infer<typeof ZUpdateFieldMutationSchema>;

export const ZDeleteFieldMutationSchema = null;

export type TDeleteFieldMutationSchema = typeof ZDeleteFieldMutationSchema;

export const ZSuccessfulFieldResponseSchema = z.object({
  id: z.number(),
  documentId: z.number(),
  recipientId: z.number(),
  type: z.nativeEnum(FieldType),
  pageNumber: z.number(),
  pageX: z.number(),
  pageY: z.number(),
  pageWidth: z.number(),
  pageHeight: z.number(),
  customText: z.string(),
  inserted: z.boolean(),
});

export type TSuccessfulFieldResponseSchema = z.infer<typeof ZSuccessfulFieldResponseSchema>;

export const ZSuccessfulResponseSchema = z.object({
  documents: ZSuccessfulDocumentResponseSchema.array(),
  totalPages: z.number(),
});

export type TSuccessfulResponseSchema = z.infer<typeof ZSuccessfulResponseSchema>;

export const ZSuccessfulSigningResponseSchema = z.object({
  message: z.string(),
});

export type TSuccessfulSigningResponseSchema = z.infer<typeof ZSuccessfulSigningResponseSchema>;

/**
 * General
 */
export const ZAuthorizationHeadersSchema = z.object({
  authorization: z.string(),
});

export type TAuthorizationHeadersSchema = z.infer<typeof ZAuthorizationHeadersSchema>;

export const ZUnsuccessfulResponseSchema = z.object({
  message: z.string(),
});

export type TUnsuccessfulResponseSchema = z.infer<typeof ZUnsuccessfulResponseSchema>;
