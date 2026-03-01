import type { Field, Signature } from '@prisma/client';

export type FieldWithSignature = Field & {
  signature?: Signature | null;
};
