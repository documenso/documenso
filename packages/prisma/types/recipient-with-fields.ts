import type { Field, Recipient } from '@prisma/client';

export type RecipientWithFields = Recipient & {
  fields: Field[];
};
