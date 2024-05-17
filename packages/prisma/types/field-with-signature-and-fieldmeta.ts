import type { Field, Signature } from '@documenso/prisma/client';
import type { FieldMeta } from '@documenso/ui/primitives/document-flow/field-item-advanced-settings';

export type FieldWithSignatureAndFieldMeta = Field & {
  Signature?: Signature | null;
  fieldMeta: FieldMeta | null;
};
