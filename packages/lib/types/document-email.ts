import { z } from 'zod';

import type { DocumentMeta } from '@documenso/prisma/client';
import { DocumentDistributionMethod } from '@documenso/prisma/client';

export enum DocumentEmailEvents {
  RecipientSigningRequest = 'recipientSigningRequest',
  RecipientRemoved = 'recipientRemoved',
  DocumentPending = 'documentPending',
  DocumentCompleted = 'documentCompleted',
  DocumentDeleted = 'documentDeleted',
}

export const ZDocumentEmailSettingsSchema = z
  .object({
    recipientSigningRequest: z.boolean().default(true),
    recipientRemoved: z.boolean().default(true),
    documentPending: z.boolean().default(true),
    documentCompleted: z.boolean().default(true),
    documentDeleted: z.boolean().default(true),
  })
  .strip()
  .catch(() => ({
    recipientSigningRequest: true,
    recipientRemoved: true,
    documentPending: true,
    documentCompleted: true,
    documentDeleted: true,
  }));

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
    documentPending: false,
    documentCompleted: false,
    documentDeleted: false,
  };
};
