import type { Field } from '@prisma/client';

/**
 * Sort the fields by the Y position on the document.
 */
export const sortFieldsByPosition = (fields: Field[]): Field[] => {
  const clonedFields: Field[] = JSON.parse(JSON.stringify(fields));

  // Sort by page first, then position on page second.
  return clonedFields.sort((a, b) => a.page - b.page || Number(a.positionY) - Number(b.positionY));
};

/**
 * Validate whether all the provided fields are inserted.
 *
 * If there are any non-inserted fields it will be highlighted and scrolled into view.
 *
 * @returns `true` if all fields are inserted, `false` otherwise.
 */
export const validateFieldsInserted = (fields: Field[]): boolean => {
  const fieldCardElements = document.getElementsByClassName('field-card-container');

  // Attach validate attribute on all fields.
  Array.from(fieldCardElements).forEach((element) => {
    element.setAttribute('data-validate', 'true');
  });

  const uninsertedFields = sortFieldsByPosition(fields.filter((field) => !field.inserted));

  const firstUninsertedField = uninsertedFields[0];

  const firstUninsertedFieldElement =
    firstUninsertedField && document.getElementById(`field-${firstUninsertedField.id}`);

  if (firstUninsertedFieldElement) {
    firstUninsertedFieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  return uninsertedFields.length === 0;
};

export const validateFieldsUninserted = (): boolean => {
  const fieldCardElements = document.getElementsByClassName('react-draggable');

  const errorElements: HTMLElement[] = [];

  Array.from(fieldCardElements).forEach((element) => {
    const innerDiv = element.querySelector('div');
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
