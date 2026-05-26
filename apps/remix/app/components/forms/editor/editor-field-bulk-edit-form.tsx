import { useMemo } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';

import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import {
  FIELD_MAX_LETTER_SPACING,
  FIELD_MAX_LINE_HEIGHT,
  FIELD_META_DEFAULT_VALUES,
  FIELD_MIN_LETTER_SPACING,
  FIELD_MIN_LINE_HEIGHT,
} from '@documenso/lib/types/field-meta';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

const MIXED_VALUE = '__mixed__';

const FIELD_TYPES_WITH_FONT_SIZE: ReadonlySet<FieldType> = new Set([
  FieldType.SIGNATURE,
  FieldType.INITIALS,
  FieldType.NAME,
  FieldType.EMAIL,
  FieldType.DATE,
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.RADIO,
  FieldType.CHECKBOX,
  FieldType.DROPDOWN,
  FieldType.CALCULATED,
]);

const FIELD_TYPES_WITH_TEXT_ALIGN: ReadonlySet<FieldType> = new Set([
  FieldType.INITIALS,
  FieldType.NAME,
  FieldType.EMAIL,
  FieldType.DATE,
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.CALCULATED,
]);

const FIELD_TYPES_WITH_VERTICAL_ALIGN: ReadonlySet<FieldType> = new Set([
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.CALCULATED,
]);

const FIELD_TYPES_WITH_LINE_METRICS: ReadonlySet<FieldType> = new Set([
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.CALCULATED,
]);

const FIELD_TYPES_WITH_REQUIRED: ReadonlySet<FieldType> = new Set([
  FieldType.INITIALS,
  FieldType.NAME,
  FieldType.EMAIL,
  FieldType.DATE,
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.RADIO,
  FieldType.CHECKBOX,
  FieldType.DROPDOWN,
  FieldType.CALCULATED,
]);

const BULK_EDITABLE_FIELD_TYPES: ReadonlyArray<FieldType> = [
  FieldType.SIGNATURE,
  FieldType.INITIALS,
  FieldType.NAME,
  FieldType.EMAIL,
  FieldType.DATE,
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.RADIO,
  FieldType.CHECKBOX,
  FieldType.DROPDOWN,
  FieldType.CALCULATED,
];

type BulkUpdates =
  | { kind: 'fontSize'; value: number }
  | { kind: 'textAlign'; value: 'left' | 'center' | 'right' }
  | { kind: 'verticalAlign'; value: 'top' | 'middle' | 'bottom' }
  | { kind: 'lineHeight'; value: number }
  | { kind: 'letterSpacing'; value: number }
  | { kind: 'required'; value: boolean }
  | { kind: 'readOnly'; value: boolean }
  | { kind: 'type'; value: FieldType };

type EditorFieldBulkEditFormProps = {
  fields: TLocalField[];
  onApply: (update: BulkUpdates) => void;
};

const readMeta = <K extends string>(field: TLocalField, key: K): unknown => {
  if (!field.fieldMeta) {
    return undefined;
  }

  return (field.fieldMeta as Record<string, unknown>)[key];
};

const collectValues = <T,>(
  fields: TLocalField[],
  applicableTypes: ReadonlySet<FieldType>,
  read: (field: TLocalField) => T | undefined,
): { applicableCount: number; commonValue: T | typeof MIXED_VALUE | undefined } => {
  const applicable = fields.filter((field) => applicableTypes.has(field.type));

  if (applicable.length === 0) {
    return { applicableCount: 0, commonValue: undefined };
  }

  const firstValue = read(applicable[0]);
  const allSame = applicable.every((field) => read(field) === firstValue);

  return {
    applicableCount: applicable.length,
    commonValue: allSame ? firstValue : MIXED_VALUE,
  };
};

export const EditorFieldBulkEditForm = ({ fields, onApply }: EditorFieldBulkEditFormProps) => {
  const { t } = useLingui();

  const summary = useMemo(() => {
    const typeSet = new Set(fields.map((field) => field.type));

    return {
      count: fields.length,
      commonType: typeSet.size === 1 ? fields[0].type : null,

      fontSize: collectValues(fields, FIELD_TYPES_WITH_FONT_SIZE, (field) => {
        const value = readMeta(field, 'fontSize');
        return typeof value === 'number' ? value : undefined;
      }),
      textAlign: collectValues(fields, FIELD_TYPES_WITH_TEXT_ALIGN, (field) => {
        const value = readMeta(field, 'textAlign');
        return typeof value === 'string' ? value : undefined;
      }),
      verticalAlign: collectValues(fields, FIELD_TYPES_WITH_VERTICAL_ALIGN, (field) => {
        const value = readMeta(field, 'verticalAlign');
        return typeof value === 'string' ? value : undefined;
      }),
      lineHeight: collectValues(fields, FIELD_TYPES_WITH_LINE_METRICS, (field) => {
        const value = readMeta(field, 'lineHeight');
        return typeof value === 'number' ? value : undefined;
      }),
      letterSpacing: collectValues(fields, FIELD_TYPES_WITH_LINE_METRICS, (field) => {
        const value = readMeta(field, 'letterSpacing');
        return typeof value === 'number' ? value : undefined;
      }),
      required: collectValues(fields, FIELD_TYPES_WITH_REQUIRED, (field) => {
        const value = readMeta(field, 'required');
        return typeof value === 'boolean' ? value : false;
      }),
      readOnly: collectValues(fields, FIELD_TYPES_WITH_REQUIRED, (field) => {
        const value = readMeta(field, 'readOnly');
        return typeof value === 'boolean' ? value : false;
      }),
    };
  }, [fields]);

  const formatNumber = (
    value: number | typeof MIXED_VALUE | undefined,
  ): { displayValue: string; placeholder?: string } => {
    if (value === MIXED_VALUE) {
      return { displayValue: '', placeholder: t`Mixed` };
    }

    if (typeof value === 'number') {
      return { displayValue: String(value) };
    }

    return { displayValue: '' };
  };

  const formatSelect = (
    value: string | typeof MIXED_VALUE | undefined,
  ): { selectValue: string | undefined; placeholder: string } => {
    if (value === MIXED_VALUE) {
      return { selectValue: undefined, placeholder: t`Mixed` };
    }

    if (typeof value === 'string') {
      return { selectValue: value, placeholder: '' };
    }

    return { selectValue: undefined, placeholder: t`Select…` };
  };

  const fontSize = formatNumber(summary.fontSize.commonValue);
  const lineHeight = formatNumber(summary.lineHeight.commonValue);
  const letterSpacing = formatNumber(summary.letterSpacing.commonValue);

  const textAlign = formatSelect(summary.textAlign.commonValue);
  const verticalAlign = formatSelect(summary.verticalAlign.commonValue);

  const requiredChecked =
    summary.required.commonValue === MIXED_VALUE ? false : !!summary.required.commonValue;
  const requiredIndeterminate = summary.required.commonValue === MIXED_VALUE;

  const readOnlyChecked =
    summary.readOnly.commonValue === MIXED_VALUE ? false : !!summary.readOnly.commonValue;
  const readOnlyIndeterminate = summary.readOnly.commonValue === MIXED_VALUE;

  return (
    <div className="flex flex-col gap-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        <Trans>
          Edits apply to every selected field that supports the property. Fields whose type does
          not support a property are left unchanged.
        </Trans>
      </p>

      {/* Field type */}
      <div className="flex flex-col gap-y-1">
        <Label className="text-xs text-foreground/70">
          <Trans>Field Type</Trans>
        </Label>
        <Select
          value={summary.commonType ?? undefined}
          onValueChange={(value) => onApply({ kind: 'type', value: value as FieldType })}
        >
          <SelectTrigger data-testid="bulk-form-field-type">
            <SelectValue placeholder={summary.commonType ? '' : t`Mixed`} />
          </SelectTrigger>
          <SelectContent>
            {BULK_EDITABLE_FIELD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          <Trans>Changing the type resets each field's type-specific settings.</Trans>
        </p>
      </div>

      {/* Font size */}
      {summary.fontSize.applicableCount > 0 && (
        <div className="flex flex-col gap-y-1">
          <Label className="text-xs text-foreground/70">
            <Trans>Font Size</Trans>
          </Label>
          <Input
            data-testid="bulk-form-font-size"
            type="number"
            min={8}
            max={96}
            value={fontSize.displayValue}
            placeholder={fontSize.placeholder ?? t`Font size`}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next) && next >= 8 && next <= 96) {
                onApply({ kind: 'fontSize', value: next });
              }
            }}
          />
        </div>
      )}

      {/* Alignment */}
      {(summary.textAlign.applicableCount > 0 || summary.verticalAlign.applicableCount > 0) && (
        <div className="flex flex-row gap-x-3">
          {summary.textAlign.applicableCount > 0 && (
            <div className="flex w-full flex-col gap-y-1">
              <Label className="text-xs text-foreground/70">
                <Trans>Text Align</Trans>
              </Label>
              <Select
                value={textAlign.selectValue}
                onValueChange={(value) =>
                  onApply({
                    kind: 'textAlign',
                    value: value as 'left' | 'center' | 'right',
                  })
                }
              >
                <SelectTrigger data-testid="bulk-form-text-align">
                  <SelectValue placeholder={textAlign.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">
                    <Trans>Left</Trans>
                  </SelectItem>
                  <SelectItem value="center">
                    <Trans>Center</Trans>
                  </SelectItem>
                  <SelectItem value="right">
                    <Trans>Right</Trans>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {summary.verticalAlign.applicableCount > 0 && (
            <div className="flex w-full flex-col gap-y-1">
              <Label className="text-xs text-foreground/70">
                <Trans>Vertical Align</Trans>
              </Label>
              <Select
                value={verticalAlign.selectValue}
                onValueChange={(value) =>
                  onApply({
                    kind: 'verticalAlign',
                    value: value as 'top' | 'middle' | 'bottom',
                  })
                }
              >
                <SelectTrigger data-testid="bulk-form-vertical-align">
                  <SelectValue placeholder={verticalAlign.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">
                    <Trans>Top</Trans>
                  </SelectItem>
                  <SelectItem value="middle">
                    <Trans>Middle</Trans>
                  </SelectItem>
                  <SelectItem value="bottom">
                    <Trans>Bottom</Trans>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Line metrics */}
      {summary.lineHeight.applicableCount > 0 && (
        <div className="flex flex-row gap-x-3">
          <div className="flex w-full flex-col gap-y-1">
            <Label className="text-xs text-foreground/70">
              <Trans>Line Height</Trans>
            </Label>
            <Input
              data-testid="bulk-form-line-height"
              type="number"
              min={FIELD_MIN_LINE_HEIGHT}
              max={FIELD_MAX_LINE_HEIGHT}
              step="0.1"
              value={lineHeight.displayValue}
              placeholder={lineHeight.placeholder ?? t`Line height`}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (
                  Number.isFinite(next) &&
                  next >= FIELD_MIN_LINE_HEIGHT &&
                  next <= FIELD_MAX_LINE_HEIGHT
                ) {
                  onApply({ kind: 'lineHeight', value: next });
                }
              }}
            />
          </div>

          <div className="flex w-full flex-col gap-y-1">
            <Label className="text-xs text-foreground/70">
              <Trans>Letter Spacing</Trans>
            </Label>
            <Input
              data-testid="bulk-form-letter-spacing"
              type="number"
              min={FIELD_MIN_LETTER_SPACING}
              max={FIELD_MAX_LETTER_SPACING}
              value={letterSpacing.displayValue}
              placeholder={letterSpacing.placeholder ?? t`Letter spacing`}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (
                  Number.isFinite(next) &&
                  next >= FIELD_MIN_LETTER_SPACING &&
                  next <= FIELD_MAX_LETTER_SPACING
                ) {
                  onApply({ kind: 'letterSpacing', value: next });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Required / Read only */}
      {summary.required.applicableCount > 0 && (
        <div className="flex flex-col gap-y-2 pt-1">
          <div className="flex items-center gap-x-2">
            <Checkbox
              data-testid="bulk-form-required"
              id="bulk-required"
              checked={requiredIndeterminate ? 'indeterminate' : requiredChecked}
              onCheckedChange={(value) => onApply({ kind: 'required', value: value === true })}
            />
            <label htmlFor="bulk-required" className="text-sm text-muted-foreground">
              <Trans>Required Field</Trans>
            </label>
          </div>

          <div className="flex items-center gap-x-2">
            <Checkbox
              data-testid="bulk-form-read-only"
              id="bulk-read-only"
              checked={readOnlyIndeterminate ? 'indeterminate' : readOnlyChecked}
              onCheckedChange={(value) => onApply({ kind: 'readOnly', value: value === true })}
            />
            <label htmlFor="bulk-read-only" className="text-sm text-muted-foreground">
              <Trans>Read Only</Trans>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export type { BulkUpdates };

/**
 * Build the per-field update payload for a bulk edit. Returns null when the
 * given field does not support the property — the caller should skip that
 * field instead of writing an invalid value.
 */
export const buildBulkFieldUpdate = (
  field: TLocalField,
  update: BulkUpdates,
): Partial<TLocalField> | null => {
  switch (update.kind) {
    case 'type': {
      if (field.type === update.value) {
        return null;
      }

      // Reset meta to defaults of new type, clear id so the new type is
      // persisted as a new field (the old row is detached server-side via
      // the diffing logic that ignores stale formIds with mismatched types).
      const defaultMeta = FIELD_META_DEFAULT_VALUES[update.value];

      return {
        type: update.value,
        id: undefined,
        fieldMeta: defaultMeta ? structuredClone(defaultMeta) : undefined,
      };
    }

    case 'fontSize': {
      if (!FIELD_TYPES_WITH_FONT_SIZE.has(field.type)) {
        return null;
      }

      return {
        fieldMeta: {
          ...(field.fieldMeta ?? {}),
          fontSize: update.value,
        } as TLocalField['fieldMeta'],
      };
    }

    case 'textAlign': {
      if (!FIELD_TYPES_WITH_TEXT_ALIGN.has(field.type)) {
        return null;
      }

      return {
        fieldMeta: {
          ...(field.fieldMeta ?? {}),
          textAlign: update.value,
        } as TLocalField['fieldMeta'],
      };
    }

    case 'verticalAlign': {
      if (!FIELD_TYPES_WITH_VERTICAL_ALIGN.has(field.type)) {
        return null;
      }

      return {
        fieldMeta: {
          ...(field.fieldMeta ?? {}),
          verticalAlign: update.value,
        } as TLocalField['fieldMeta'],
      };
    }

    case 'lineHeight': {
      if (!FIELD_TYPES_WITH_LINE_METRICS.has(field.type)) {
        return null;
      }

      return {
        fieldMeta: {
          ...(field.fieldMeta ?? {}),
          lineHeight: update.value,
        } as TLocalField['fieldMeta'],
      };
    }

    case 'letterSpacing': {
      if (!FIELD_TYPES_WITH_LINE_METRICS.has(field.type)) {
        return null;
      }

      return {
        fieldMeta: {
          ...(field.fieldMeta ?? {}),
          letterSpacing: update.value,
        } as TLocalField['fieldMeta'],
      };
    }

    case 'required': {
      if (!FIELD_TYPES_WITH_REQUIRED.has(field.type)) {
        return null;
      }

      const next: Record<string, unknown> = {
        ...(field.fieldMeta ?? {}),
        required: update.value,
      };

      // Mirror the single-field form invariant: required and readOnly are
      // mutually exclusive.
      if (update.value) {
        next.readOnly = false;
      }

      return { fieldMeta: next as TLocalField['fieldMeta'] };
    }

    case 'readOnly': {
      if (!FIELD_TYPES_WITH_REQUIRED.has(field.type)) {
        return null;
      }

      const next: Record<string, unknown> = {
        ...(field.fieldMeta ?? {}),
        readOnly: update.value,
      };

      if (update.value) {
        next.required = false;
      }

      return { fieldMeta: next as TLocalField['fieldMeta'] };
    }

    default:
      return null;
  }
};
