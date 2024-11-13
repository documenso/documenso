import type { Field } from '@documenso/prisma/client';

// List of advanced field types that can skip validation if not required
const ADVANCED_FIELD_TYPES = ['NUMBER', 'TEXT', 'DROPDOWN', 'RADIO', 'CHECKBOX'];

/**
 * Sort the fields by the Y position on the document.
 */
export const sortFieldsByPosition = (fields: Field[]): Field[] => {
  const clonedFields: Field[] = JSON.parse(JSON.stringify(fields));
  // Sort by page first, then position on page second.
  return clonedFields.sort((a, b) => a.page - b.page || Number(a.positionY) - Number(b.positionY));
};

/**
 * Validate whether all the required fields are inserted.
 * Advanced fields (NUMBER, TEXT, DROPDOWN, RADIO, CHECKBOX) without fieldMeta
 * or fieldMeta.required will pass validation automatically.
 *
 * @returns `true` if all required fields are inserted, `false` otherwise.
 */
export const validateFieldsInserted = (fields: Field[]): boolean => {
  const fieldCardElements = document.getElementsByClassName('field-card-container');
  // Attach validate attribute on all fields.
  Array.from(fieldCardElements).forEach((element) => {
    element.setAttribute('data-validate', 'true');
  });

  // Filter out advanced fields that don't need validation
  const fieldsRequiringValidation = fields.filter((field) => {
    const isAdvancedField = ADVANCED_FIELD_TYPES.includes(field.type);
    const isRequired = field.fieldMeta?.required;

    // Return true if field needs validation (not advanced or is required)
    return !isAdvancedField || (field.fieldMeta && isRequired);
  });

  const uninsertedFields = sortFieldsByPosition(
    fieldsRequiringValidation.filter((field) => !field.inserted),
  );

  const firstUninsertedField = uninsertedFields[0];
  const firstUninsertedFieldElement =
    firstUninsertedField && document.getElementById(`field-${firstUninsertedField.id}`);

  if (firstUninsertedFieldElement) {
    firstUninsertedFieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  return uninsertedFields.length === 0;
};

/**
 * Validates fields based on their type and required status.
 * Advanced fields (NUMBER, TEXT, DROPDOWN, RADIO, CHECKBOX) without fieldMeta
 * or fieldMeta.required will pass validation automatically.
 *
 * @returns `true` if all fields pass validation, `false` otherwise.
 */
export const validateFieldsUninserted = (fields: Field[]): boolean => {
  const fieldCardElements = document.getElementsByClassName('react-draggable');
  const errorElements: HTMLElement[] = [];

  Array.from(fieldCardElements).forEach((element) => {
    const innerDiv = element.querySelector('div');
    const fieldId = element.getAttribute('data-field-id');
    const field = fields.find((f) => f.id === fieldId);

    // Skip validation for advanced fields that don't have fieldMeta or aren't required
    const isAdvancedField = field && ADVANCED_FIELD_TYPES.includes(field.type);
    const isRequired = field?.fieldMeta?.required;

    if (isAdvancedField && (!field.fieldMeta || !isRequired)) {
      element.removeAttribute('data-error');
      return;
    }

    const hasError = innerDiv?.getAttribute('data-error') === 'true';
    if (hasError) {
      errorElements.push(element as HTMLElement);
    } else {
      element.removeAttribute('data-error');
    }
  });

  if (errorElements.length > 0) {
    errorElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  return errorElements.length === 0;
};
