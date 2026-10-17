import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import { type Field, FieldType } from '@prisma/client';

import { validateCheckboxLength } from '../advanced-fields-validation/validate-checkbox';
import { AppError, AppErrorCode } from '../errors/app-error';
import { ZCheckboxFieldMeta } from '../types/field-meta';
import { isRequiredField } from './advanced-fields-helpers';
import { groupFieldsByGroupId } from './field-groups';
import { parseCheckboxCustomText } from './fields';

export type CheckboxValidationRule = (typeof checkboxValidationSigns)[number]['value'];

/**
 * Why an inserted signing item is not valid.
 */
export type SigningItemValidationError = {
  type: 'CHECKBOX_LENGTH';
  validationRule: CheckboxValidationRule;
  validationLength: number;
  selectedCount: number;
};

/**
 * A single unit of work for a recipient when signing. Either a standalone field, or every
 * field in a group which acts as one field.
 */
export type SigningItem = {
  /**
   * Every field which makes up the item.
   */
  fields: Field[];
  /**
   * The field to navigate to for this item, which is the first field by document order.
   */
  primaryField: Field;
  groupId: string | null;
  isRequired: boolean;
  isInserted: boolean;
  /**
   * Set when the item has been inserted but does not satisfy its validation rules.
   */
  validationError: SigningItemValidationError | null;
};

/**
 * Builds the signing items for a recipient's fields, treating each group as one item.
 */
export const getSigningItems = (fields: Field[]): SigningItem[] => {
  const ungroupedFields = fields.filter((field) => !field.groupId);
  const groupedFields = groupFieldsByGroupId(fields);

  const standaloneItems = ungroupedFields.map((field) => createSigningItem([field], null));

  const groupItems = Array.from(groupedFields.entries()).map(([groupId, members]) =>
    createSigningItem(members, groupId),
  );

  return [...standaloneItems, ...groupItems];
};

/**
 * Whether the item still requires action from the recipient before they can complete.
 *
 * An inserted optional item is treated as required, so its validation rules apply.
 */
export const isSigningItemPending = (item: SigningItem): boolean => {
  if (!item.isInserted) {
    return item.isRequired;
  }

  return item.validationError !== null;
};

export const getPendingSigningItems = (fields: Field[]): SigningItem[] => {
  return getSigningItems(fields).filter(isSigningItemPending);
};

/**
 * Whether any of the fields block the recipient from completing the document.
 */
export const fieldsContainPendingSigningItem = (fields: Field[]): boolean => {
  return getSigningItems(fields).some(isSigningItemPending);
};

const createSigningItem = (fields: Field[], groupId: string | null): SigningItem => {
  const sortedFields = sortFieldsByDocumentOrder(fields);

  const isInserted = sortedFields.some((field) => field.inserted);

  return {
    fields: sortedFields,
    primaryField: sortedFields[0],
    groupId,
    isRequired: sortedFields.some((field) => isRequiredField(field)),
    isInserted,
    validationError: isInserted ? resolveSigningItemValidationError(sortedFields) : null,
  };
};

/**
 * Validates an inserted item. Only checkbox items currently carry a rule which can be
 * violated after insertion, since the options are pooled across the item.
 */
const resolveSigningItemValidationError = (fields: Field[]): SigningItemValidationError | null => {
  const [firstField] = fields;

  if (firstField.type !== FieldType.CHECKBOX) {
    return null;
  }

  const parsedFieldMeta = ZCheckboxFieldMeta.safeParse(firstField.fieldMeta);

  if (!parsedFieldMeta.success) {
    return null;
  }

  const { validationRule, validationLength } = parsedFieldMeta.data;

  if (!validationRule || !validationLength) {
    return null;
  }

  const checkboxValidationRule = checkboxValidationSigns.find((sign) => sign.label === validationRule);

  if (!checkboxValidationRule) {
    return null;
  }

  const selectedCount = fields.reduce(
    (total, field) => total + (field.customText ? parseCheckboxCustomText(field.customText).length : 0),
    0,
  );

  if (validateCheckboxLength(selectedCount, checkboxValidationRule.value, validationLength)) {
    return null;
  }

  return {
    type: 'CHECKBOX_LENGTH',
    validationRule: checkboxValidationRule.value,
    validationLength,
    selectedCount,
  };
};

const sortFieldsByDocumentOrder = (fields: Field[]): Field[] => {
  return [...fields].sort((a, b) => a.page - b.page || Number(a.positionY) - Number(b.positionY));
};

/**
 * Throws if the recipient's fields contain any item which blocks completion.
 */
export const assertRecipientSigningItemsComplete = (recipientId: number, fields: Field[]): void => {
  const pendingItems = getPendingSigningItems(fields);

  if (pendingItems.length === 0) {
    return;
  }

  const hasUnsignedItems = pendingItems.some((item) => !item.isInserted);

  if (hasUnsignedItems) {
    throw new AppError(AppErrorCode.RECIPIENT_HAS_UNSIGNED_FIELDS, {
      message: `Recipient ${recipientId} has unsigned fields`,
      statusCode: 400,
    });
  }

  throw new AppError(AppErrorCode.RECIPIENT_HAS_INVALID_FIELDS, {
    message: `Recipient ${recipientId} has fields which do not satisfy their validation rules`,
    statusCode: 400,
  });
};
