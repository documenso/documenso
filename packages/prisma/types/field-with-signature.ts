import type { Field, Signature } from '../generated/client';

export type FieldWithSignature = Field & {
  signature?: Signature | null;
};
