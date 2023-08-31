import { Document, Recipient } from '@documenso/prisma/client';

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
