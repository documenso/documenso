import type { Document, Prisma, Recipient } from '@documenso/prisma/client';

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

export type DocumentFromDocumentById = Prisma.DocumentGetPayload<{
  include: {
    documentData: true;
    documentMeta: true;
    User: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    team: {
      select: {
        id: true;
        url: true;
      };
    };
  };
}>;
