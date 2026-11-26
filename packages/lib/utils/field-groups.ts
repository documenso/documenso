import { FieldType } from '@prisma/client';
import { isDeepEqual } from 'remeda';

import { validateCheckboxField } from '../advanced-fields-validation/validate-checkbox';
import { validateRadioField } from '../advanced-fields-validation/validate-radio';
import { canFieldTypeBeGrouped, FIELD_GROUP_SHARED_META_DEFAULTS } from '../constants/field-groups';
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
  FIELD_GROUP_SHARED_META_DEFAULTS,
} from '../constants/field-groups';

/**
 * The minimum shape required to validate a group of fields.
 */
export type FieldGroupItem = {
  id?: number | null;
  type: FieldType;
  recipientId: number;
  groupId?: string | null;
  fieldMeta?: TFieldMetaSchema | null;
};

/**
 * Returns the shared meta values for the given field, with every shared key present.
 *
 * A key the field does not set takes its default from `FIELD_GROUP_SHARED_META_DEFAULTS`,
 * so two fields compare equally whether a setting was left out or written out as unused.
 */
export const extractFieldGroupSharedMeta = (
  type: FieldType,
  fieldMeta: TFieldMetaSchema | null,
): Record<string, unknown> => {
  const meta: Record<string, unknown> = { ...fieldMeta };

  return Object.fromEntries(
    Object.entries(FIELD_GROUP_SHARED_META_DEFAULTS[type]).map(([key, defaultValue]) => [
      key,
      meta[key] ?? defaultValue,
    ]),
  );
};

/**
 * Returns the target field meta with the shared keys overwritten by the source field meta.
 *
 * Used to propagate shared values from an updated field to its group siblings.
 */
export const mergeFieldGroupSharedMeta = <T extends TFieldMetaSchema>(
  type: FieldType,
  targetMeta: T,
  sourceMeta: TFieldMetaSchema | null,
): T => {
  const sharedKeys = Object.keys(FIELD_GROUP_SHARED_META_DEFAULTS[type]);

  if (!targetMeta) {
    return targetMeta;
  }

  const source: Record<string, unknown> = { ...sourceMeta };

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
  const otherSharedMetas = items.slice(1).map((item) => extractFieldGroupSharedMeta(item.type, item.fieldMeta));

  const mismatchedSharedKeys = Object.keys(firstSharedMeta).filter((key) =>
    otherSharedMetas.some((sharedMeta) => !isDeepEqual(sharedMeta[key], firstSharedMeta[key])),
  );

  if (mismatchedSharedKeys.length > 0) {
    errors.push(
      `Group "${groupId}": the following field meta values must be identical for all fields in the group: ${mismatchedSharedKeys.join(', ')}`,
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
  const groupOptions = items.flatMap((item) => {
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

  const checkedValue = groupOptions.find((value) => value.checked)?.value;

  const errors = validateRadioField(checkedValue, {
    ...firstParsed.data,
    values: groupOptions,
  });

  return errors.map((error) => `Group "${groupId}": ${error}`);
};

const validateCheckboxFieldGroup = (groupId: string, items: FieldGroupItem[]): string[] => {
  const groupOptions = items.flatMap((item) => {
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
    groupOptions.map((value) => value.value),
    {
      ...firstParsed.data,
      values: groupOptions,
    },
  );

  return errors.map((error) => `Group "${groupId}": ${error}`);
};

/**
 * Groups the provided fields by their group ID and validates each group.
 *
 * Fields without a group ID are ignored. The provided list should represent the
 * final state of all fields in the envelope, otherwise rules which count options
 * across a group will be incorrect.
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
export const parseFieldMetaOrDefault = (type: FieldType, fieldMeta: TFieldMetaSchema | null): TFieldMetaSchema => {
  // Stored meta is only typed by the Prisma JSON type generator, not validated, so it can
  // still be malformed or an empty object at runtime.
  const parsed = ZFieldMetaSchema.safeParse(fieldMeta);

  return parsed.success && parsed.data ? parsed.data : FIELD_META_DEFAULT_VALUES[type];
};

const FIELD_GROUP_ID_PREFIX = 'grp';
const FIELD_GROUP_ID_LENGTH = 6;
const FIELD_GROUP_ID_MAX_ATTEMPTS = 20;

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
  siblingMeta: TFieldMetaSchema | null,
  sourceMeta: TFieldMetaSchema | null,
): TFieldMetaSchema => {
  return mergeFieldGroupSharedMeta(type, parseFieldMetaOrDefault(type, siblingMeta), sourceMeta);
};
