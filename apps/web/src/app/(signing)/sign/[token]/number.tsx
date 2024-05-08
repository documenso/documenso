'use client';

import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

export type NumberFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const NumberField = ({ field, recipient }: NumberFieldProps) => {
  return <h1>Number</h1>;
};
