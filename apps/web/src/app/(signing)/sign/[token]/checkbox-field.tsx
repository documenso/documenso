'use client';

import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

export type CheckboxFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const CheckboxField = ({ field, recipient }: CheckboxFieldProps) => {
  return <h1>Number</h1>;
};
