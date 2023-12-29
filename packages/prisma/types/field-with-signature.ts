import type { Field, Signature } from '@documenso/prisma/client';

export type FieldWithSignature = Field & {
  Signature?: Signature | null;
};
