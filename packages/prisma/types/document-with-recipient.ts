import { Document, Recipient } from '@documenso/prisma/client';

export type DocumentWithReciepient = Document & {
  Recipient: Recipient[];
};
