import type { Field, Recipient } from '../generated/client';

export type RecipientWithFields = Recipient & {
  fields: Field[];
};
