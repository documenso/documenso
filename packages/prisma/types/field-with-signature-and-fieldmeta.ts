import type { Field, Signature } from '../generated/client';

import { type TFieldMetaSchema as FieldMeta } from '@documenso/lib/types/field-meta';

export type FieldWithSignatureAndFieldMeta = Field & {
  signature?: Signature | null;
  fieldMeta: FieldMeta | null;
};
