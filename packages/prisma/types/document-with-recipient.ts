import type { DocumentData, Envelope, Recipient } from '@prisma/client';

export type EnvelopeWithRecipients = Envelope & {
  recipients: Recipient[];
};

export type EnvelopeWithRecipient = Envelope & {
  recipients: Recipient[];
  documentData: DocumentData;
};
