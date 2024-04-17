<<<<<<< HEAD
import { Document, Recipient } from '@documenso/prisma/client';
=======
import type {
  Document,
  DocumentData,
  DocumentMeta,
  Field,
  Recipient,
} from '@documenso/prisma/client';
>>>>>>> main

export type DocumentWithRecipientAndSender = Omit<Document, 'document'> & {
  recipient: Recipient;
  sender: {
    id: number;
    name: string | null;
    email: string;
  };
  subject: string;
  description: string;
};
<<<<<<< HEAD
=======

export type DocumentWithDetails = Document & {
  documentData: DocumentData;
  documentMeta: DocumentMeta | null;
  Recipient: Recipient[];
  Field: Field[];
};
>>>>>>> main
