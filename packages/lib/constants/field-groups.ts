import { FieldType } from '@prisma/client';

/**
 * Field types which can be part of a group.
 *
 * Signature, free signature, initials and date fields are intentionally excluded.
 */
export const ALLOWED_FIELD_GROUP_TYPES: FieldType[] = [
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.CHECKBOX,
  FieldType.RADIO,
  FieldType.DROPDOWN,
  FieldType.NAME,
  FieldType.EMAIL,
];

export const canFieldTypeBeGrouped = (type: FieldType): boolean => {
  return ALLOWED_FIELD_GROUP_TYPES.includes(type);
};

/**
 * Field types where every field in a group holds the same value, so inserting or
 * uninserting one field applies to the whole group.
 *
 * Radio and checkbox groups don't share a value. Each field keeps its own options and
 * selection, and the group's rules count selections across all of its fields.
 */
export const FIELD_GROUP_SHARED_VALUE_TYPES: FieldType[] = [
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.DROPDOWN,
  FieldType.NAME,
  FieldType.EMAIL,
];

export const isFieldGroupValueShared = (type: FieldType): boolean => {
  return FIELD_GROUP_SHARED_VALUE_TYPES.includes(type);
};

const BASE_SHARED_META_KEYS = ['required', 'readOnly', 'label'] as const;

/**
 * The field meta keys that must be identical for every field within a group.
 *
 * Only values that affect validation or the logical value of the field are shared.
 * Purely visual properties (font size, alignment, direction, etc) remain per field.
 */
export const FIELD_GROUP_SHARED_META_KEYS: Record<FieldType, readonly string[]> = {
  [FieldType.TEXT]: [...BASE_SHARED_META_KEYS, 'characterLimit', 'text'],
  [FieldType.NUMBER]: [...BASE_SHARED_META_KEYS, 'numberFormat', 'minValue', 'maxValue', 'value'],
  [FieldType.CHECKBOX]: [...BASE_SHARED_META_KEYS, 'validationRule', 'validationLength'],
  [FieldType.RADIO]: [...BASE_SHARED_META_KEYS],
  [FieldType.DROPDOWN]: [...BASE_SHARED_META_KEYS, 'values', 'defaultValue'],
  [FieldType.NAME]: [...BASE_SHARED_META_KEYS],
  [FieldType.EMAIL]: [...BASE_SHARED_META_KEYS],
  [FieldType.SIGNATURE]: [],
  [FieldType.FREE_SIGNATURE]: [],
  [FieldType.INITIALS]: [],
  [FieldType.DATE]: [],
};
