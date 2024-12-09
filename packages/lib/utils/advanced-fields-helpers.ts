import type { Field } from '@documenso/prisma/client';

import { ZFieldMetaSchema } from '../types/field-meta';

const ADVANCED_FIELD_TYPES = ['NUMBER', 'TEXT', 'DROPDOWN', 'RADIO', 'CHECKBOX'];

export function isAdvancedField(fieldType: string) {
  return ADVANCED_FIELD_TYPES.includes(fieldType);
}

export function isOptionalAdvancedField(field: Field) {
  if (!isAdvancedField(field.type)) {
    return false;
  }

  if (!field.fieldMeta) {
    return true;
  }

  const parsedData = ZFieldMetaSchema.safeParse(field.fieldMeta);

  if (parsedData.success && !parsedData.data?.required) {
    return true;
  } else {
    return false;
  }
}

export function isRequiredField(field: Field) {
  if (!field.fieldMeta) {
    return false;
  }

  const parsedData = ZFieldMetaSchema.safeParse(field.fieldMeta);

  if (!parsedData.success) {
    return false;
  }

  return parsedData.data?.required === true;
}
