<<<<<<< HEAD
import { Document, DocumentData, Recipient } from '@documenso/prisma/client';
=======
import type { Document, DocumentData, Recipient } from '@documenso/prisma/client';
>>>>>>> main

export type DocumentWithRecipients = Document & {
  Recipient: Recipient[];
};

export type DocumentWithRecipient = Document & {
<<<<<<< HEAD
  Recipient: Recipient;
=======
  Recipient: Recipient[];
>>>>>>> main
  documentData: DocumentData;
};
