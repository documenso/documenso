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

const BASE_SHARED_META_DEFAULTS = {
  required: false,
  readOnly: false,
  label: '',
} as const;

/**
 * The field meta keys which must be identical for every field within a group, each with
 * the value it has when a field does not set it.
 *
 * Only values that affect validation or the logical value of the field are shared.
 * Purely visual properties (font size, alignment, direction, etc) remain per field.
 *
 * The defaults exist because stored meta has no single form: a setting which is not in use
 * can be missing, null or written out, depending on whether the field came from the editor
 * or the API. Comparing against the default makes those match.
 *
 * A default must behave exactly like a missing value when signing. A number's limits and a
 * dropdown's options are null for that reason: a maximum of 0 only lets 0 be entered, and
 * an empty option list rejects every value, while a missing one does neither.
 */
export const FIELD_GROUP_SHARED_META_DEFAULTS: Record<FieldType, Readonly<Record<string, unknown>>> = {
  [FieldType.TEXT]: { ...BASE_SHARED_META_DEFAULTS, characterLimit: 0, text: '' },
  [FieldType.NUMBER]: { ...BASE_SHARED_META_DEFAULTS, numberFormat: '', minValue: null, maxValue: null, value: '' },
  [FieldType.CHECKBOX]: { ...BASE_SHARED_META_DEFAULTS, validationRule: '', validationLength: 0 },
  [FieldType.RADIO]: BASE_SHARED_META_DEFAULTS,
  [FieldType.DROPDOWN]: { ...BASE_SHARED_META_DEFAULTS, values: null, defaultValue: '' },
  [FieldType.NAME]: BASE_SHARED_META_DEFAULTS,
  [FieldType.EMAIL]: BASE_SHARED_META_DEFAULTS,
  [FieldType.SIGNATURE]: {},
  [FieldType.FREE_SIGNATURE]: {},
  [FieldType.INITIALS]: {},
  [FieldType.DATE]: {},
};
