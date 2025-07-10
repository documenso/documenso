import { FieldType } from '@prisma/client';

export const AUTO_SIGNABLE_FIELD_TYPES: FieldType[] = [
  FieldType.NAME,
  FieldType.INITIALS,
  FieldType.EMAIL,
  FieldType.DATE,
];
