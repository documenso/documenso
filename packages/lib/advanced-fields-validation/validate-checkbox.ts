import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';

interface CheckboxFieldMeta {
  readOnly?: boolean;
  required?: boolean;
  validationRule?: string;
  validationLength?: number;
}

export const validateCheckboxField = (
  values: string[],
  fieldMeta: CheckboxFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = [];

  const { readOnly, required, validationRule, validationLength } = fieldMeta;

  if (readOnly && required) {
    errors.push('A field cannot be both read-only and required');
  }

  if (readOnly && values.length === 0) {
    errors.push('A read-only field must have at least one value');
  }

  if (isSigningPage && required && values.length === 0) {
    errors.push('Selecting an option is required');
  }

  if (validationRule && !validationLength) {
    errors.push('You need to specify the number of options for validation');
  }

  if (validationLength && !validationRule) {
    errors.push('You need to specify the validation rule');
  }

  if (validationRule && validationLength) {
    const validation = checkboxValidationSigns.find((sign) => sign.label === validationRule);
    const lengthCondition =
      (validation?.value === '>=' && values.length < validationLength) ||
      (validation?.value === '=' && values.length !== validationLength) ||
      (validation?.value === '<=' && values.length > validationLength);

    if (lengthCondition) {
      errors.push(`You need to ${validationRule.toLowerCase()} ${validationLength} options`);
    }
  }

  return errors;
};
