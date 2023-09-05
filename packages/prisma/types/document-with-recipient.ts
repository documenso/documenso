import { Document, Recipient } from '@documenso/prisma/client';

export type DocumentWithRecipients = Document & {
  Recipient: Recipient[];
};

export type DocumentWithRecipient = Document & {
  Recipient: Recipient;
};
