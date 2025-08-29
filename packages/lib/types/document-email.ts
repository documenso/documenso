import type { DocumentMeta } from '@prisma/client';
import { DocumentDistributionMethod } from '@prisma/client';
import { z } from 'zod';

export enum DocumentEmailEvents {
  RecipientSigningRequest = 'recipientSigningRequest',
  RecipientRemoved = 'recipientRemoved',
  RecipientSigned = 'recipientSigned',
  DocumentPending = 'documentPending',
  DocumentCompleted = 'documentCompleted',
  DocumentDeleted = 'documentDeleted',
  OwnerDocumentCompleted = 'ownerDocumentCompleted',
}

export const ZDocumentEmailSettingsSchema = z
  .object({
    recipientSigningRequest: z
      .boolean()
      .describe(
        'Whether to send an email to all recipients that the document is ready for them to sign.',
      )
      .default(true),
    recipientRemoved: z
      .boolean()
      .describe(
        'Whether to send an email to the recipient who was removed from a pending document.',
      )
      .default(true),
    recipientSigned: z
      .boolean()
      .describe(
        'Whether to send an email to the document owner when a recipient has signed the document.',
      )
      .default(true),
    documentPending: z
      .boolean()
      .describe(
        'Whether to send an email to the recipient who has just signed the document indicating that there are still other recipients who need to sign the document. This will only be sent if the document is still pending after the recipient has signed.',
      )
      .default(true),
    documentCompleted: z
      .boolean()
      .describe('Whether to send an email to all recipients when the document is complete.')
      .default(true),
    documentDeleted: z
      .boolean()
      .describe(
        'Whether to send an email to all recipients if a pending document has been deleted.',
      )
      .default(true),
    ownerDocumentCompleted: z
      .boolean()
      .describe('Whether to send an email to the document owner when the document is complete.')
      .default(true),
  })
  .strip()
  .catch(() => ({ ...DEFAULT_DOCUMENT_EMAIL_SETTINGS }));

export type TDocumentEmailSettings = z.infer<typeof ZDocumentEmailSettingsSchema>;

export const extractDerivedDocumentEmailSettings = (
  documentMeta?: DocumentMeta | null,
): TDocumentEmailSettings => {
  const emailSettings = ZDocumentEmailSettingsSchema.parse(documentMeta?.emailSettings ?? {});

  if (
    !documentMeta?.distributionMethod ||
    documentMeta?.distributionMethod === DocumentDistributionMethod.EMAIL
  ) {
    return emailSettings;
  }

  return {
    recipientSigningRequest: false,
    recipientRemoved: false,
    recipientSigned: false,
    documentPending: false,
    documentCompleted: false,
    documentDeleted: false,
    ownerDocumentCompleted: emailSettings.ownerDocumentCompleted,
  };
};

export const DEFAULT_DOCUMENT_EMAIL_SETTINGS: TDocumentEmailSettings = {
  recipientSigningRequest: true,
  recipientRemoved: true,
  recipientSigned: true,
  documentPending: true,
  documentCompleted: true,
  documentDeleted: true,
  ownerDocumentCompleted: true,
};
