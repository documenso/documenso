'use client';

import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

export type RadioFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const RadioField = ({ field, recipient }: RadioFieldProps) => {
  return <h1>Number</h1>;
};
