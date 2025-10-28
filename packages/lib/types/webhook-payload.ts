import type { DocumentMeta, Envelope, Recipient, WebhookTriggerEvents } from '@prisma/client';
import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  EnvelopeType,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';
import { z } from 'zod';

import { mapSecondaryIdToDocumentId, mapSecondaryIdToTemplateId } from '../utils/envelope';

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

export type WebhookPayload = {
  event: WebhookTriggerEvents;
  payload: TWebhookDocument;
  createdAt: string;
  webhookEndpoint: string;
};

export const mapEnvelopeToWebhookDocumentPayload = (
  envelope: Envelope & {
    recipients: Recipient[];
    documentMeta: DocumentMeta | null;
  },
): TWebhookDocument => {
  const { recipients: rawRecipients, documentMeta } = envelope;

  const legacyId =
    envelope.type === EnvelopeType.DOCUMENT
      ? mapSecondaryIdToDocumentId(envelope.secondaryId)
      : mapSecondaryIdToTemplateId(envelope.secondaryId);

  const mappedRecipients = rawRecipients.map((recipient) => ({
    id: recipient.id,
    documentId: envelope.type === EnvelopeType.DOCUMENT ? legacyId : null,
    templateId: envelope.type === EnvelopeType.TEMPLATE ? legacyId : null,
    email: recipient.email,
    name: recipient.name,
    token: recipient.token,
    documentDeletedAt: recipient.documentDeletedAt,
    expired: recipient.expired,
    signedAt: recipient.signedAt,
    authOptions: recipient.authOptions,
    signingOrder: recipient.signingOrder,
    rejectionReason: recipient.rejectionReason,
    role: recipient.role,
    readStatus: recipient.readStatus,
    signingStatus: recipient.signingStatus,
    sendStatus: recipient.sendStatus,
  }));

  return {
    id: legacyId,
    externalId: envelope.externalId,
    userId: envelope.userId,
    authOptions: envelope.authOptions,
    formValues: envelope.formValues,
    visibility: envelope.visibility,
    title: envelope.title,
    status: envelope.status,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    completedAt: envelope.completedAt,
    deletedAt: envelope.deletedAt,
    teamId: envelope.teamId,
    templateId: envelope.templateId,
    source: envelope.source,
    documentMeta: documentMeta
      ? {
          ...documentMeta,
          // Not sure why is optional in the prisma schema.
          timezone: 'Etc/UTC',
          dateFormat: 'yyyy-MM-dd hh:mm a',
        }
      : null,
    Recipient: mappedRecipients,
    recipients: mappedRecipients,
  };
};
