<<<<<<< HEAD
import { Recipient } from '@documenso/prisma/client';

export const recipientInitials = (text: string) =>
=======
import type { Recipient } from '@documenso/prisma/client';

export const extractInitials = (text: string) =>
>>>>>>> main
  text
    .split(' ')
    .map((name: string) => name.slice(0, 1).toUpperCase())
    .slice(0, 2)
    .join('');

export const recipientAbbreviation = (recipient: Recipient) => {
<<<<<<< HEAD
  return recipientInitials(recipient.name) || recipient.email.slice(0, 1).toUpperCase();
=======
  return extractInitials(recipient.name) || recipient.email.slice(0, 1).toUpperCase();
>>>>>>> main
};
