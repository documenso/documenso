import type { Field, Signature } from '@documenso/prisma/client';

export type FieldWithSignature = Field & {
  signature?: Signature | null;
};
