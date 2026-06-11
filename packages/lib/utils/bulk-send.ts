import type { FieldType } from '@prisma/client';

import type { TFieldMetaPrefillFieldsSchema } from '../types/field-meta';

/**
 * Field types that can receive per-recipient merge data during a bulk send.
 *
 * The value maps the Prisma `FieldType` enum to the lowercase discriminator used by
 * `ZFieldMetaPrefillFieldsSchema` (see `packages/lib/types/field-meta.ts`), which is what
 * `createDocumentFromTemplate` consumes via its `prefillFields` argument.
 */
export const BULK_SEND_PREFILLABLE_FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  DROPDOWN: 'dropdown',
  DATE: 'date',
} as const;

export type TBulkSendPrefillableFieldType = keyof typeof BULK_SEND_PREFILLABLE_FIELD_TYPES;

export const isBulkSendPrefillableFieldType = (
  type: FieldType,
): type is TBulkSendPrefillableFieldType => type in BULK_SEND_PREFILLABLE_FIELD_TYPES;

/**
 * Prefix for the CSV columns that carry per-recipient merge data for a specific template field.
 * The full column name is `field_<fieldId>` (see {@link getBulkSendFieldColumnName}).
 */
export const BULK_SEND_FIELD_COLUMN_PREFIX = 'field_';

/**
 * Builds the canonical CSV column name for a template field's merge data. Frontend (template
 * generation/legend) and backend (CSV parsing) both rely on this so the contract stays in sync.
 */
export const getBulkSendFieldColumnName = (fieldId: number) =>
  `${BULK_SEND_FIELD_COLUMN_PREFIX}${fieldId}`;

/**
 * Delimiter used within a single CHECKBOX field cell to separate multiple selected values,
 * e.g. `Option A;Option B`. A comma can't be used since it is the CSV column separator.
 */
export const BULK_SEND_CHECKBOX_VALUE_DELIMITER = ';';

export type BulkSendTemplateField = {
  id: number;
  type: FieldType;
};

/**
 * Translate the `field_<id>` columns of a single parsed CSV row into the `prefillFields` payload
 * that `createDocumentFromTemplate` understands, so each recipient gets their own merged values.
 *
 * Only fields whose type supports prefilling are considered, and blank cells are skipped so the
 * template's own default value is preserved for that recipient.
 */
export const buildBulkSendPrefillFields = (
  fields: BulkSendTemplateField[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>,
): TFieldMetaPrefillFieldsSchema[] => {
  const prefillFields: TFieldMetaPrefillFieldsSchema[] = [];

  for (const field of fields) {
    if (!isBulkSendPrefillableFieldType(field.type)) {
      continue;
    }

    const columnName = getBulkSendFieldColumnName(field.id);

    if (!(columnName in row)) {
      continue;
    }

    const rawValue = row[columnName];

    if (rawValue === undefined || rawValue === null || `${rawValue}`.trim() === '') {
      continue;
    }

    const value = `${rawValue}`;
    const prefillType = BULK_SEND_PREFILLABLE_FIELD_TYPES[field.type];

    if (prefillType === 'checkbox') {
      prefillFields.push({
        id: field.id,
        type: 'checkbox',
        value: value
          .split(BULK_SEND_CHECKBOX_VALUE_DELIMITER)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
      });

      continue;
    }

    prefillFields.push({
      id: field.id,
      type: prefillType,
      value,
    });
  }

  return prefillFields;
};
