import { useEffect, useMemo } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import { useForm, useWatch } from 'react-hook-form';

import {
  type TCalculatedFieldMeta as CalculatedFieldMeta,
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_CALCULATED_PRECISION,
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_MAX_CALCULATED_PRECISION,
  FIELD_MIN_CALCULATED_PRECISION,
} from '@documenso/lib/types/field-meta';
import {
  FORMULA_FUNCTIONS,
  detectCircularReferences,
  extractFormulaReferences,
  validateFormulaSyntax,
} from '@documenso/lib/utils/formula-field';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Textarea } from '@documenso/ui/primitives/textarea';

import {
  EditorGenericFontSizeField,
  EditorGenericLabelField,
  EditorGenericTextAlignField,
  EditorGenericVerticalAlignField,
} from './editor-field-generic-field-forms';

/** A field that may be referenced from a formula. */
export type ReferenceableField = { label: string; type: FieldType };

type EditorFieldCalculatedFormProps = {
  value: CalculatedFieldMeta | undefined;
  onValueChange: (value: CalculatedFieldMeta) => void;
  /** Numeric / calculated fields (with labels) that this formula can reference. */
  availableFields: ReferenceableField[];
  /** All other calculated fields, for circular reference detection. */
  calculatedFields: { label: string; formula: string }[];
};

type CalculatedFieldFormSchema = {
  label: string;
  formula: string;
  precision: number;
  fontSize: number;
  textAlign: NonNullable<CalculatedFieldMeta['textAlign']>;
  verticalAlign: NonNullable<CalculatedFieldMeta['verticalAlign']>;
};

export const EditorFieldCalculatedForm = ({
  value = { type: 'calculated' },
  onValueChange,
  availableFields,
  calculatedFields,
}: EditorFieldCalculatedFormProps) => {
  const { t } = useLingui();

  const form = useForm<CalculatedFieldFormSchema>({
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      formula: value.formula || '',
      precision: value.precision ?? FIELD_DEFAULT_CALCULATED_PRECISION,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      verticalAlign: value.verticalAlign ?? FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
    },
  });

  const { control, setValue, getValues } = form;

  const formValues = useWatch({ control });

  const formula = formValues.formula ?? '';
  const ownLabel = formValues.label ?? '';

  /**
   * Live validation of the formula: syntax, unknown references and circular
   * references. Recomputed whenever the formula or label changes.
   */
  const validation = useMemo(() => {
    if (!formula.trim()) {
      return { error: undefined as string | undefined };
    }

    const syntax = validateFormulaSyntax(formula);

    if (!syntax.valid) {
      return { error: syntax.error };
    }

    const knownLabels = new Set(availableFields.map((field) => field.label));
    const unknownRefs = extractFormulaReferences(formula).filter((ref) => !knownLabels.has(ref));

    if (unknownRefs.length > 0) {
      return {
        error: t`Unknown field reference(s): ${unknownRefs.map((ref) => `{${ref}}`).join(', ')}`,
      };
    }

    const cycles = detectCircularReferences([
      ...calculatedFields,
      ...(ownLabel ? [{ label: ownLabel, formula }] : []),
    ]);

    if (ownLabel && cycles.has(ownLabel)) {
      return { error: t`This formula creates a circular reference.` };
    }

    return { error: undefined };
  }, [formula, ownLabel, availableFields, calculatedFields, t]);

  useEffect(() => {
    // Only propagate valid formulas (or an empty formula being cleared).
    if (validation.error) {
      return;
    }

    onValueChange({
      type: 'calculated',
      label: formValues.label || '',
      formula: formValues.formula || '',
      precision: formValues.precision ?? FIELD_DEFAULT_CALCULATED_PRECISION,
      fontSize: formValues.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: formValues.textAlign,
      verticalAlign: formValues.verticalAlign,
      // Calculated fields are always read only and never required of the signer.
      readOnly: true,
      required: false,
    });
  }, [formValues, validation.error]);

  const appendToFormula = (snippet: string) => {
    const current = getValues('formula') ?? '';
    const needsSpace = current.length > 0 && !/\s$/.test(current);
    setValue('formula', `${current}${needsSpace ? ' ' : ''}${snippet}`, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericLabelField formControl={form.control} />

          <FormField
            control={form.control}
            name="formula"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Formula</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="field-form-formula"
                    className="bg-background font-mono text-sm"
                    placeholder={t`E.g. {Miles} * 0.655`}
                    rows={3}
                    {...field}
                  />
                </FormControl>
                {validation.error ? (
                  <p className="text-sm font-medium text-destructive">{validation.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <Trans>
                      Reference fields with {'{Label}'}. Supports + - * / ( ) and SUM, ROUND, MIN,
                      MAX.
                    </Trans>
                  </p>
                )}
              </FormItem>
            )}
          />

          {availableFields.length > 0 ? (
            <div className="flex flex-col gap-1">
              <FormLabel className="text-xs text-muted-foreground">
                <Trans>Insert field</Trans>
              </FormLabel>
              <div className="flex flex-wrap gap-1">
                {availableFields.map((available) => (
                  <Button
                    key={available.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => appendToFormula(`{${available.label}}`)}
                  >
                    {available.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Trans>
                Add Number fields with labels to this document to reference them in a formula.
              </Trans>
            </p>
          )}

          <div className="flex flex-col gap-1">
            <FormLabel className="text-xs text-muted-foreground">
              <Trans>Insert function</Trans>
            </FormLabel>
            <div className="flex flex-wrap gap-1">
              {FORMULA_FUNCTIONS.map((fn) => (
                <Button
                  key={fn}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => appendToFormula(`${fn}()`)}
                >
                  {fn}
                </Button>
              ))}
            </div>
          </div>

          <FormField
            control={form.control}
            name="precision"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Decimal places</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="field-form-precision"
                    type="number"
                    min={FIELD_MIN_CALCULATED_PRECISION}
                    max={FIELD_MAX_CALCULATED_PRECISION}
                    className="bg-background"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <EditorGenericFontSizeField className="w-full" formControl={form.control} />

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericTextAlignField className="w-full" formControl={form.control} />

            <EditorGenericVerticalAlignField className="w-full" formControl={form.control} />
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
