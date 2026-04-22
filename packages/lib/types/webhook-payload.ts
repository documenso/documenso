import type {
  DocumentMeta,
  Envelope,
  Field,
  Recipient,
  WebhookTriggerEvents,
} from '@prisma/client';
import {
  DocumentDistributionMethod,
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  DocumentVisibility,
  EnvelopeType,
  FieldType,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';
import { z } from 'zod';

import { evaluateAllVisibility } from '../universal/field-visibility';
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
  expiresAt: z.date().nullable(),
  expirationNotifiedAt: z.date().nullable(),
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
 * Schema for field data in webhook payloads.
 * Only visible (non-hidden) fields are included.
 */
export const ZWebhookFieldSchema = z.object({
  id: z.number(),
  recipientId: z.number(),
  type: z.nativeEnum(FieldType),
  page: z.number(),
  positionX: z.any(),
  positionY: z.any(),
  width: z.any(),
  height: z.any(),
  customText: z.string(),
  inserted: z.boolean(),
  fieldMeta: z.any().nullable(),
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
   * Visible fields across all recipients. Hidden conditional fields are excluded.
   * Only populated for completion events (document.signed, document.recipient_completed).
   * Empty array for other lifecycle events.
   */
  fields: z.array(ZWebhookFieldSchema),

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
    fields?: Field[];
  },
): TWebhookDocument => {
  const { recipients: rawRecipients, documentMeta, fields: rawFields = [] } = envelope;

  const legacyId =
    envelope.type === EnvelopeType.DOCUMENT
      ? mapSecondaryIdToDocumentId(envelope.secondaryId)
      : mapSecondaryIdToTemplateId(envelope.secondaryId);

  // Build the set of visible fields by evaluating visibility per recipient.
  // Visibility is recipient-scoped: a dependent field can only reference trigger
  // fields belonging to the same recipient.
  const visibleFieldIds = new Set<number>();

  if (rawFields.length > 0) {
    // Group fields by recipientId.
    const fieldsByRecipient = new Map<number, Field[]>();
    for (const field of rawFields) {
      const group = fieldsByRecipient.get(field.recipientId) ?? [];
      group.push(field);
      fieldsByRecipient.set(field.recipientId, group);
    }

    // For each recipient's field set, evaluate visibility and collect visible ids.
    for (const recipientFields of fieldsByRecipient.values()) {
      const evaluatableFields = recipientFields.map((f) => ({
        id: f.id,
        type: f.type,
        customText: f.customText,
        inserted: f.inserted,
        fieldMeta: f.fieldMeta,
      }));
      const visibilityMap = evaluateAllVisibility(evaluatableFields);
      for (const [fieldId, visible] of visibilityMap.entries()) {
        if (visible !== false) {
          visibleFieldIds.add(fieldId);
        }
      }
    }
  }

  const visibleFields = rawFields.filter((f) => visibleFieldIds.has(f.id));

  const mappedRecipients = rawRecipients.map((recipient) => ({
    id: recipient.id,
    documentId: envelope.type === EnvelopeType.DOCUMENT ? legacyId : null,
    templateId: envelope.type === EnvelopeType.TEMPLATE ? legacyId : null,
    email: recipient.email,
    name: recipient.name,
    token: recipient.token,
    documentDeletedAt: recipient.documentDeletedAt,
    expiresAt: recipient.expiresAt,
    expirationNotifiedAt: recipient.expirationNotifiedAt,
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
    fields: visibleFields.map((f) => ({
      id: f.id,
      recipientId: f.recipientId,
      type: f.type,
      page: f.page,
      positionX: f.positionX,
      positionY: f.positionY,
      width: f.width,
      height: f.height,
      customText: f.customText,
      inserted: f.inserted,
      fieldMeta: f.fieldMeta,
    })),
    Recipient: mappedRecipients,
    recipients: mappedRecipients,
  };
};
