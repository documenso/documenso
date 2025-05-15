import type { Document, DocumentData, Recipient } from '@prisma/client';

export type DocumentWithRecipients = Document & {
  recipients: Recipient[];
};

export type DocumentWithRecipient = Document & {
  recipients: Recipient[];
  documentData: DocumentData;
};
