import { FieldType } from '@prisma/client';

import type {
  TCheckboxFieldMeta,
  TDropdownFieldMeta,
  TNumberFieldMeta,
  TRadioFieldMeta,
  TTextFieldMeta,
} from '../types/field-meta';

type ValueBearingFieldMeta =
  | TTextFieldMeta
  | TNumberFieldMeta
  | TRadioFieldMeta
  | TCheckboxFieldMeta
  | TDropdownFieldMeta;

/**
 * Validates the configuration-only field meta rules the Field Types
 * documentation promises, independent of any signer-supplied value.
 *
 * These are the rules the API create path can and must enforce upfront:
 * the combination bans and the read-only default-value requirements.
 * Value-dependent rules (character limits, signing-page requirements)
 * remain with the signing-time validators.
 *
 * @param type The field's type.
 * @param fieldMeta The field meta carried by the create request.
 * @returns A list of rule violations, empty when the configuration is legal.
 */
export const validateFieldMetaConfiguration = (
  type: FieldType,
  fieldMeta: Partial<ValueBearingFieldMeta> | undefined,
): string[] => {
  if (!fieldMeta) {
    return [];
  }

  const errors = [];

  const { required, readOnly } = fieldMeta;

  if (required && readOnly) {
    errors.push('A field cannot be both read-only and required');
  }

  if (readOnly) {
    switch (type) {
      case FieldType.TEXT:
        if (!fieldMeta.text) {
          errors.push('A read-only field must have text');
        }
        break;

      case FieldType.NUMBER: {
        const value = (fieldMeta as TNumberFieldMeta).value;
        const parsed = value !== undefined ? Number.parseFloat(value) : Number.NaN;

        if (value === undefined || value === '' || parsed < 1) {
          errors.push('A read-only field must have a value greater than 0');
        }
        break;
      }

      case FieldType.RADIO:
      case FieldType.CHECKBOX:
      case FieldType.DROPDOWN:
        if (!fieldMeta.values || fieldMeta.values.length === 0) {
          errors.push('A read-only field must have at least one value');
        }
        break;

      default:
        // Signature-style fields carry no value-bearing default to check.
        break;
    }
  }

  return errors;
};
