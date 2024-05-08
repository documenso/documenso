'use client';

import type { Recipient } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

export type DropdownFieldProps = {
  field: FieldWithSignature;
  recipient: Recipient;
};

export const DropdownField = ({ field, recipient }: DropdownFieldProps) => {
  return <h1>Dropdown</h1>;
};
