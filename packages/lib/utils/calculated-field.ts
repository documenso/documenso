import { type Field, FieldType } from '@prisma/client';

import {
  type CalculatedValueResult,
  type FormulaFieldInput,
  evaluateCalculatedField,
} from './formula-field';

/**
 * The minimal field shape required to compute calculated field values. Works for
 * both Prisma `Field` records (server) and parsed signing fields (client).
 */
export type CalculatedFieldLike = Pick<Field, 'type' | 'customText' | 'inserted'> & {
  fieldMeta?: unknown;
};

type LooseFieldMeta = {
  label?: string | null;
  value?: string | null;
  formula?: string | null;
  precision?: number | null;
};

const readMeta = (field: CalculatedFieldLike): LooseFieldMeta => {
  if (field.fieldMeta && typeof field.fieldMeta === 'object') {
    return field.fieldMeta as LooseFieldMeta;
  }

  return {};
};

const toFiniteNumber = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Resolve the current numeric value of a referenceable field. Only NUMBER and
 * CALCULATED fields are referenceable; everything else resolves to null.
 */
const resolveNumericValue = (field: CalculatedFieldLike): number | null => {
  const meta = readMeta(field);

  if (field.type === FieldType.NUMBER) {
    // Prefer the value the signer entered; fall back to a preset/read-only value.
    return toFiniteNumber(field.inserted ? field.customText : null) ?? toFiniteNumber(meta.value);
  }

  return null;
};

/**
 * Map a set of fields into the normalized inputs the formula engine consumes.
 */
export const buildFormulaInputs = (fields: CalculatedFieldLike[]): FormulaFieldInput[] =>
  fields.map((field) => {
    const meta = readMeta(field);
    const isCalculated = field.type === FieldType.CALCULATED;

    return {
      label: meta.label ?? '',
      isCalculated,
      numericValue: isCalculated ? null : resolveNumericValue(field),
      formula: isCalculated ? (meta.formula ?? '') : undefined,
    };
  });

/**
 * Compute a calculated field's value against the current state of all fields.
 */
export const computeCalculatedFieldValue = (
  field: CalculatedFieldLike,
  allFields: CalculatedFieldLike[],
): CalculatedValueResult => {
  const meta = readMeta(field);

  return evaluateCalculatedField(
    meta.formula ?? '',
    buildFormulaInputs(allFields),
    meta.precision ?? undefined,
    meta.label ?? undefined,
  );
};
