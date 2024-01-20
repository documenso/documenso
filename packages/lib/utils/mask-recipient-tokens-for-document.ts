import type { User } from '@documenso/prisma/client';
import type { DocumentWithRecipients } from '@documenso/prisma/types/document-with-recipient';

export type MaskRecipientTokensForDocumentOptions<T extends DocumentWithRecipients> = {
  document: T;
  user?: User;
  token?: string;
};

export const maskRecipientTokensForDocument = <T extends DocumentWithRecipients>({
  document,
  user,
  token,
}: MaskRecipientTokensForDocumentOptions<T>) => {
  const maskedRecipients = document.Recipient.map((recipient) => {
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
