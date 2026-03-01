import type { DocumentData, Envelope, Recipient } from '../generated/client';

export type EnvelopeWithRecipients = Envelope & {
  recipients: Recipient[];
};

export type EnvelopeWithRecipient = Envelope & {
  recipients: Recipient[];
  documentData: DocumentData;
};
