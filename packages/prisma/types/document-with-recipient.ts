import { Document, Recipient } from '@documenso/prisma/client';

export type DocumentWithRecipient = Document & {
  Recipient: Recipient[];
};
