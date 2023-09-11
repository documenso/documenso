import { Recipient } from '@documenso/prisma/client';

import { initials } from './recipient-initials';

export const recipientAvatarFallback = (recipient: Recipient) => {
  return initials(recipient.name) || recipient.email.slice(0, 1).toUpperCase();
};
