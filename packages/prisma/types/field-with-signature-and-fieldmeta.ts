import { type TFieldMetaSchema as FieldMeta } from '@documenso/lib/types/field-meta';
import type { Field, Signature } from '@documenso/prisma/client';

export type FieldWithSignatureAndFieldMeta = Field & {
  Signature?: Signature | null;
  fieldMeta: FieldMeta | null;
};
