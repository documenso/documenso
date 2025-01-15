import type { Field, Recipient } from '@documenso/prisma/client';

export type RecipientWithFields = Recipient & {
  Field: Field[];
};
