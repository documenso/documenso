import type { Envelope } from '@prisma/client';
import { type Recipient } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';
import type { TTemplateLite } from '../types/template';
import { mapSecondaryIdToTemplateId } from './envelope';

export const formatDirectTemplatePath = (token: string) => {
  return `${NEXT_PUBLIC_WEBAPP_URL()}/d/${token}`;
};

/**
 * Generate a placeholder recipient using an index number.
 *
 * May collide with existing recipients.
 *
 * Note:
 * - Update TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX if this is ever changed.
 * - Update TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX if this is ever changed.
 *
 */
export const generateRecipientPlaceholder = (index: number) => {
  return {
    name: `Recipient ${index}`,
    email: `recipient.${index}@documenso.com`,
  };
};

/**
 * Generates a placeholder that does not collide with any existing recipients.
 *
 * @param currentRecipients The current recipients that exist for a template.
 */
export const generateAvaliableRecipientPlaceholder = (currentRecipients: Recipient[]) => {
  const recipientEmails = currentRecipients.map((recipient) => recipient.email);
  let recipientPlaceholder = generateRecipientPlaceholder(0);

  for (let i = 1; i <= currentRecipients.length + 1; i++) {
    recipientPlaceholder = generateRecipientPlaceholder(i);

    if (!recipientEmails.includes(recipientPlaceholder.email)) {
      return recipientPlaceholder;
    }
  }

  return recipientPlaceholder;
};

export const mapEnvelopeToTemplateLite = (envelope: Envelope): TTemplateLite => {
  const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);

  return {
    id: legacyTemplateId,
    envelopeId: envelope.secondaryId,
    type: envelope.templateType,
    visibility: envelope.visibility,
    externalId: envelope.externalId,
    title: envelope.title,
    userId: envelope.userId,
    teamId: envelope.teamId,
    authOptions: envelope.authOptions,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    publicTitle: envelope.publicTitle,
    publicDescription: envelope.publicDescription,
    folderId: envelope.folderId,
    useLegacyFieldInsertion: envelope.useLegacyFieldInsertion,
    templateDocumentDataId: '',
  };
};
