import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { type Envelope, type Field, FieldType } from '@prisma/client';

import { extractLegacyIds } from '../universal/id';

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

export const mapFieldToLegacyField = (
  field: Field,
  envelope: Pick<Envelope, 'type' | 'secondaryId'>,
) => {
  const legacyId = extractLegacyIds(envelope);

  return {
    ...field,
    ...legacyId,
  };
};

export const parseCheckboxCustomText = (customText: string): number[] => {
  if (!customText) {
    return [];
  }

  return JSON.parse(customText);
};

export const toCheckboxCustomText = (checkedValues: number[]): string => {
  return JSON.stringify(checkedValues);
};

export const parseRadioCustomText = (customText: string): number => {
  return Number(customText);
};

export const toRadioCustomText = (value: number): string => {
  return value.toString();
};

export const getClientSideFieldTranslations = ({ t }: I18n): Record<FieldType, string> => {
  return {
    [FieldType.TEXT]: t(msg`Text`),
    [FieldType.CHECKBOX]: t(msg`Checkbox`),
    [FieldType.RADIO]: t(msg`Radio`),
    [FieldType.DROPDOWN]: t(msg`Select Option`),
    [FieldType.SIGNATURE]: t(msg`Signature`),
    [FieldType.FREE_SIGNATURE]: t(msg`Free Signature`),
    [FieldType.INITIALS]: t(msg`Initials`),
    [FieldType.NAME]: t(msg`Name`),
    [FieldType.NUMBER]: t(msg`Number`),
    [FieldType.DATE]: t(msg`Date`),
    [FieldType.EMAIL]: t(msg`Email`),
  };
};
