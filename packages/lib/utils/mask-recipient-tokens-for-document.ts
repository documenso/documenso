import type { User } from '@prisma/client';

import type { EnvelopeWithRecipients } from '@documenso/prisma/types/document-with-recipient';

export type MaskRecipientTokensForDocumentOptions<T extends EnvelopeWithRecipients> = {
  document: T;
  user?: Pick<User, 'id' | 'email'>;
  token?: string;
};

export const maskRecipientTokensForDocument = <T extends EnvelopeWithRecipients>({
  document,
  user,
  token,
}: MaskRecipientTokensForDocumentOptions<T>) => {
  const maskedRecipients = document.recipients.map((recipient) => {
    if (document.userId === user?.id) {
      return recipient;
    }

    if (recipient.email === user?.email) {
      return recipient;
    }

    if (recipient.token === token) {
      return recipient;
    }

    return {
      ...recipient,
      token: '',
    };
  });

  return {
    ...document,
    Recipient: maskedRecipients,
  };
};
