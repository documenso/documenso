import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import { type Field, FieldType } from '@prisma/client';

import { validateCheckboxLength } from '../advanced-fields-validation/validate-checkbox';
import { AppError, AppErrorCode } from '../errors/app-error';
import { ZCheckboxFieldMeta } from '../types/field-meta';
import { fieldsContainUnsignedRequiredField, isRequiredField } from './advanced-fields-helpers';
import { groupFieldsByGroupId } from './field-groups';
import { parseCheckboxCustomText } from './fields';

export type CheckboxValidationRule = (typeof checkboxValidationSigns)[number]['value'];

/**
 * Why an inserted signing item is not valid.
 *
 * Can extend this as a union in the future to cover other validation errors.
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
   * The field to navigate to for this item, which is the first field by document order.
   */
  primaryField: Field;
  /**
   * Every field which makes up the item.
   */
  fields: Field[];
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
  const groupedFields = groupFieldsByGroupId(fields);
  const ungroupedFields = fields.filter((field) => !field.groupId);
  const standaloneItems = ungroupedFields.map((field) => createSigningItem([field], null));

  const groupItems = Array.from(groupedFields.entries()).map(([groupId, groupFields]) =>
    createSigningItem(groupFields, groupId),
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
 * The fields of a pending item the recipient still has to fill in, so counters can count
 * each field in a group.
 *
 * A checkbox group which was ticked but breaks its rule only needs its fields without a
 * selection, or a single field when every field has one and the rule is still broken.
 */
export const getSigningItemPendingFields = (item: SigningItem): Field[] => {
  if (!isSigningItemPending(item)) {
    return [];
  }

  if (!item.isInserted) {
    return item.fields;
  }

  const emptyFields = item.fields.filter((field) => !field.customText);

  return emptyFields.length > 0 ? emptyFields : [item.primaryField];
};

/**
 * Every field still to be filled in, optional or not, with each field in a group counted.
 */
export const getRemainingFields = (fields: Field[]): Field[] => {
  const pendingFieldIds = new Set(
    getPendingSigningItems(fields)
      .flatMap(getSigningItemPendingFields)
      .map((field) => field.id),
  );

  return fields.filter((field) => !field.inserted || pendingFieldIds.has(field.id));
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
 * violated after insertion, since selections are counted across all of the item's fields.
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
 * Whether the fields stop their recipients completing the document.
 *
 * V2 treats a group as one field and applies checkbox rules to inserted fields. V1 only
 * checks required fields: it validates each field when inserted, and stores checkbox
 * values in a format the V2 rule check cannot parse.
 */
export const hasIncompleteFields = (internalVersion: number, fields: Field[]): boolean => {
  if (internalVersion !== 2) {
    return fieldsContainUnsignedRequiredField(fields);
  }

  return getPendingSigningItems(fields).length > 0;
};

type AssertRecipientFieldsCompleteOptions = {
  internalVersion: number;
  recipientId: number;
  fields: Field[];
};

/**
 * Throws if the recipient's fields stop them completing the document.
 */
export const assertRecipientFieldsComplete = ({
  internalVersion,
  recipientId,
  fields,
}: AssertRecipientFieldsCompleteOptions): void => {
  if (hasIncompleteFields(internalVersion, fields)) {
    throw new AppError(AppErrorCode.RECIPIENT_HAS_UNSIGNED_FIELDS, {
      message: `Recipient ${recipientId} has unsigned fields`,
      statusCode: 400,
    });
  }
};
