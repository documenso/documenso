import { RecipientRole } from '@prisma/client';

import type { TDocumentEmailSettings } from '../types/document-email';
import type { TRecipientLite } from '../types/recipient';
import { isRecipientEmailValidForSending } from './recipients';

type DocumentCompletedEmailRecipient = Pick<TRecipientLite, 'id' | 'email' | 'name' | 'role' | 'token'>;

/**
 * Recipients who should receive the document-completed email (with PDF attachment).
 *
 * Signers/viewers follow the `documentCompleted` setting. CC recipients still need the
 * executed agreement when only the owner completion email is enabled (for example when
 * distribution is not EMAIL and recipient notifications are derived off).
 */
export const getDocumentCompletedEmailRecipients = <T extends DocumentCompletedEmailRecipient>(
  recipients: T[],
  emailSettings: Pick<TDocumentEmailSettings, 'documentCompleted' | 'ownerDocumentCompleted'>,
): T[] => {
  const deliverableRecipients = recipients.filter((recipient) => isRecipientEmailValidForSending(recipient));

  if (emailSettings.documentCompleted) {
    return deliverableRecipients;
  }

  if (!emailSettings.ownerDocumentCompleted) {
    return [];
  }

  return deliverableRecipients.filter((recipient) => recipient.role === RecipientRole.CC);
};
