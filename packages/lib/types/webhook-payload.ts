import type { Document, DocumentMeta, Recipient } from '@prisma/client';
import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';
import { z } from 'zod';

/**
 * Schema for recipient data in webhook payloads.
 */
export const ZWebhookRecipientSchema = z.object({
  id: z.number(),
  documentId: z.number().nullable(),
  templateId: z.number().nullable(),
  email: z.string(),
  name: z.string(),
  token: z.string(),
  documentDeletedAt: z.date().nullable(),
  expired: z.date().nullable(),
  signedAt: z.date().nullable(),
  authOptions: z.any().nullable(),
  signingOrder: z.number().nullable(),
  rejectionReason: z.string().nullable(),
  role: z.nativeEnum(RecipientRole),
  readStatus: z.nativeEnum(ReadStatus),
  signingStatus: z.nativeEnum(SigningStatus),
  sendStatus: z.nativeEnum(SendStatus),
});

/**
 * Schema for document meta in webhook payloads.
 */
export const ZWebhookDocumentMetaSchema = z.object({
  id: z.string(),
  subject: z.string().nullable(),
  message: z.string().nullable(),
  timezone: z.string(),
  password: z.string().nullable(),
  dateFormat: z.string(),
  redirectUrl: z.string().nullable(),
  signingOrder: z.nativeEnum(DocumentSigningOrder),
  allowDictateNextSigner: z.boolean(),
  typedSignatureEnabled: z.boolean(),
  uploadSignatureEnabled: z.boolean(),
  drawSignatureEnabled: z.boolean(),
  language: z.string(),
  distributionMethod: z.nativeEnum(DocumentDistributionMethod),
  emailSettings: z.any().nullable(),
});

/**
 * Schema for document data in webhook payloads.
 */
export const ZWebhookDocumentSchema = z.object({
  id: z.number(),
  externalId: z.string().nullable(),
  userId: z.number(),
  authOptions: z.any().nullable(),
  formValues: z.any().nullable(),
  visibility: z.nativeEnum(DocumentVisibility),
  title: z.string(),
  status: z.nativeEnum(DocumentStatus),
  documentDataId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  teamId: z.number().nullable(),
  templateId: z.number().nullable(),
  source: z.nativeEnum(DocumentSource),
  documentMeta: ZWebhookDocumentMetaSchema.nullable(),
  recipients: z.array(ZWebhookRecipientSchema),

  /**
   * Legacy field for backwards compatibility.
   */
  Recipient: z.array(ZWebhookRecipientSchema),
});

export type TWebhookRecipient = z.infer<typeof ZWebhookRecipientSchema>;
export type TWebhookDocument = z.infer<typeof ZWebhookDocumentSchema>;

export const mapDocumentToWebhookDocumentPayload = (
  document: Document & {
    recipients: Recipient[];
    documentMeta: DocumentMeta | null;
  },
): TWebhookDocument => {
  const { recipients, documentMeta, ...trimmedDocument } = document;

  return {
    ...trimmedDocument,
    documentMeta: documentMeta
      ? {
          ...documentMeta,
          // Not sure why is optional in the prisma schema.
          timezone: 'Etc/UTC',
          dateFormat: 'yyyy-MM-dd hh:mm a',
        }
      : null,
    Recipient: recipients,
    recipients,
  };
};
