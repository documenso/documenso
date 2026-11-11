import { FieldType } from '@prisma/client';
import { isDeepEqual } from 'remeda';

import { validateCheckboxField } from '../advanced-fields-validation/validate-checkbox';
import { validateRadioField } from '../advanced-fields-validation/validate-radio';
import { canFieldTypeBeGrouped, FIELD_GROUP_SHARED_META_KEYS } from '../constants/field-groups';
import { AppError, AppErrorCode } from '../errors/app-error';
import {
  FIELD_META_DEFAULT_VALUES,
  type TFieldMetaSchema,
  ZCheckboxFieldMeta,
  ZFieldMetaSchema,
  ZRadioFieldMeta,
} from '../types/field-meta';
import { prefixedId } from '../universal/id';

export {
  ALLOWED_FIELD_GROUP_TYPES,
  canFieldTypeBeGrouped,
  FIELD_GROUP_SHARED_META_KEYS,
} from '../constants/field-groups';

/**
 * The minimum shape required to validate a group of fields.
 */
export type FieldGroupItem = {
  id?: number | null;
  type: FieldType;
  recipientId: number;
  groupId?: string | null;
  fieldMeta?: unknown;
};

/**
 * Returns a copy of the shared meta values for the given field.
 *
 * Null and undefined values are omitted so they compare equally.
 */
export const extractFieldGroupSharedMeta = (type: FieldType, fieldMeta: unknown): Record<string, unknown> => {
  const sharedKeys = FIELD_GROUP_SHARED_META_KEYS[type];

  if (!fieldMeta || typeof fieldMeta !== 'object') {
    return {};
  }

  const meta: Record<string, unknown> = { ...fieldMeta };
  const shared: Record<string, unknown> = {};

  for (const key of sharedKeys) {
    const value = meta[key];

    if (value === undefined || value === null) {
      continue;
    }

    shared[key] = value;
  }

  return shared;
};

/**
 * Returns the target field meta with the shared keys overwritten by the source field meta.
 *
 * Used to propagate shared values from an updated field to its group siblings.
 */
export const mergeFieldGroupSharedMeta = <T extends TFieldMetaSchema>(
  type: FieldType,
  targetMeta: T,
  sourceMeta: unknown,
): T => {
  const sharedKeys = FIELD_GROUP_SHARED_META_KEYS[type];

  if (!targetMeta) {
    return targetMeta;
  }

  const source: Record<string, unknown> = sourceMeta && typeof sourceMeta === 'object' ? { ...sourceMeta } : {};

  const merged: Record<string, unknown> = { ...targetMeta };

  for (const key of sharedKeys) {
    if (source[key] === undefined || source[key] === null) {
      delete merged[key];
      continue;
    }

    merged[key] = source[key];
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return merged as T;
};

/**
 * Validates a single group of fields which all share the same group ID.
 *
 * Returns a list of error messages, an empty list means the group is valid.
 */
export const validateFieldGroup = (groupId: string, items: FieldGroupItem[]): string[] => {
  const errors: string[] = [];

  if (items.length === 0) {
    return errors;
  }

  const [firstItem] = items;

  if (!canFieldTypeBeGrouped(firstItem.type)) {
    errors.push(`Group "${groupId}": ${firstItem.type} fields cannot be grouped`);

    return errors;
  }

  if (items.some((item) => item.type !== firstItem.type)) {
    errors.push(`Group "${groupId}": all fields in a group must be the same type`);

    return errors;
  }

  if (items.some((item) => item.recipientId !== firstItem.recipientId)) {
    errors.push(`Group "${groupId}": all fields in a group must belong to the same recipient`);
  }

  const firstSharedMeta = extractFieldGroupSharedMeta(firstItem.type, firstItem.fieldMeta);

  const hasMismatchedSharedMeta = items.some(
    (item) => !isDeepEqual(extractFieldGroupSharedMeta(item.type, item.fieldMeta), firstSharedMeta),
  );

  if (hasMismatchedSharedMeta) {
    const sharedKeys = FIELD_GROUP_SHARED_META_KEYS[firstItem.type].join(', ');

    errors.push(
      `Group "${groupId}": the following field meta values must be identical for all fields in the group: ${sharedKeys}`,
    );
  }

  if (firstItem.type === FieldType.RADIO) {
    errors.push(...validateRadioFieldGroup(groupId, items));
  }

  if (firstItem.type === FieldType.CHECKBOX) {
    errors.push(...validateCheckboxFieldGroup(groupId, items));
  }

  return errors;
};

const validateRadioFieldGroup = (groupId: string, items: FieldGroupItem[]): string[] => {
  const pooledValues = items.flatMap((item) => {
    const parsed = ZRadioFieldMeta.safeParse(item.fieldMeta);

    if (!parsed.success) {
      return [];
    }

    return parsed.data.values ?? [];
  });

  const firstParsed = ZRadioFieldMeta.safeParse(items[0].fieldMeta);

  if (!firstParsed.success) {
    return [`Group "${groupId}": radio fields are missing required metadata`];
  }

  const checkedValue = pooledValues.find((value) => value.checked)?.value;

  const errors = validateRadioField(checkedValue, {
    ...firstParsed.data,
    values: pooledValues,
  });

  return errors.map((error) => `Group "${groupId}": ${error}`);
};

const validateCheckboxFieldGroup = (groupId: string, items: FieldGroupItem[]): string[] => {
  const pooledValues = items.flatMap((item) => {
    const parsed = ZCheckboxFieldMeta.safeParse(item.fieldMeta);

    if (!parsed.success) {
      return [];
    }

    return parsed.data.values ?? [];
  });

  const firstParsed = ZCheckboxFieldMeta.safeParse(items[0].fieldMeta);

  if (!firstParsed.success) {
    return [`Group "${groupId}": checkbox fields are missing required metadata`];
  }

  const errors = validateCheckboxField(
    pooledValues.map((value) => value.value),
    {
      ...firstParsed.data,
      values: pooledValues,
    },
  );

  return errors.map((error) => `Group "${groupId}": ${error}`);
};

/**
 * Groups the provided fields by their group ID and validates each group.
 *
 * Fields without a group ID are ignored. The provided list should represent the
 * final state of all fields in the envelope, otherwise pooled validation will be
 * incorrect.
 *
 * @throws AppError if any group is invalid.
 */
export const assertFieldGroupsValid = (fields: FieldGroupItem[]): void => {
  const groups = groupFieldsByGroupId(fields);

  const errors: string[] = [];

  for (const [groupId, items] of groups) {
    errors.push(...validateFieldGroup(groupId, items));
  }

  if (errors.length > 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: errors.join('. '),
      userMessage: errors.join('. '),
    });
  }
};

/**
 * Throws if the field type cannot be grouped but a group ID was provided.
 */
export const assertFieldGroupAllowedForType = (type: FieldType, groupId?: string | null): void => {
  if (!groupId) {
    return;
  }

  if (!canFieldTypeBeGrouped(type)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `${type} fields cannot be grouped`,
      userMessage: `${type} fields cannot be grouped`,
    });
  }
};

/**
 * Parses field meta, falling back to the default meta for the field type when missing or invalid.
 */
export const parseFieldMetaOrDefault = (type: FieldType, fieldMeta: unknown): TFieldMetaSchema => {
  const parsed = ZFieldMetaSchema.safeParse(fieldMeta);

  return parsed.success && parsed.data ? parsed.data : FIELD_META_DEFAULT_VALUES[type];
};

const FIELD_GROUP_ID_PREFIX = 'grp';
const FIELD_GROUP_ID_LENGTH = 4;
const FIELD_GROUP_ID_MAX_ATTEMPTS = 10;

/**
 * Generates a new group ID in the form `grp_xxxx` which is not already in use.
 *
 * Falls back to a longer ID in the unlikely event every attempt collides.
 */
export const generateFieldGroupId = (existingGroupIds: string[] = []): string => {
  for (let attempt = 0; attempt < FIELD_GROUP_ID_MAX_ATTEMPTS; attempt += 1) {
    const groupId = prefixedId(FIELD_GROUP_ID_PREFIX, FIELD_GROUP_ID_LENGTH);

    if (!existingGroupIds.includes(groupId)) {
      return groupId;
    }
  }

  return prefixedId(FIELD_GROUP_ID_PREFIX, FIELD_GROUP_ID_LENGTH * 2);
};

export const groupFieldsByGroupId = <T extends { groupId?: string | null }>(fields: T[]): Map<string, T[]> => {
  const groups = new Map<string, T[]>();

  for (const field of fields) {
    if (!field.groupId) {
      continue;
    }

    const items = groups.get(field.groupId) ?? [];

    items.push(field);

    groups.set(field.groupId, items);
  }

  return groups;
};

/**
 * Resolves the field meta to use for a group sibling when another field in the group
 * has been updated. Falls back to the default meta for the field type if the sibling
 * currently has no meta.
 */
export const resolveSyncedSiblingFieldMeta = (
  type: FieldType,
  siblingMeta: unknown,
  sourceMeta: unknown,
): TFieldMetaSchema => {
  return mergeFieldGroupSharedMeta(type, parseFieldMetaOrDefault(type, siblingMeta), sourceMeta);
};
