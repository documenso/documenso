import { validateNumberFieldValue } from '@documenso/lib/advanced-fields-validation/validate-number';
import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
  type TNumberFieldMeta as NumberFieldMeta,
  ZNumberFieldMeta,
} from '@documenso/lib/types/field-meta';
import { numberFormatValues } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Separator } from '@documenso/ui/primitives/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  EditorGenericFontSizeField,
  EditorGenericLabelField,
  EditorGenericLetterSpacingField,
  EditorGenericLineHeightField,
  EditorGenericReadOnlyField,
  EditorGenericRequiredField,
  EditorGenericTextAlignField,
  EditorGenericVerticalAlignField,
} from './editor-field-generic-field-forms';

const ZNumberFieldFormSchema = ZNumberFieldMeta.pick({
  label: true,
  placeholder: true,
  value: true,
  numberFormat: true,
  fontSize: true,
  textAlign: true,
  lineHeight: true,
  letterSpacing: true,
  verticalAlign: true,
  required: true,
  readOnly: true,
  minValue: true,
  maxValue: true,
})
  .refine(
    (data) => {
      // Minimum value cannot be greater than maximum value
      if (typeof data.minValue === 'number' && typeof data.maxValue === 'number') {
        return data.minValue <= data.maxValue;
      }
      return true;
    },
    {
      message: 'Minimum value cannot be greater than maximum value',
      path: ['minValue'],
    },
  )
  .superRefine((data, ctx) => {
    if (data.readOnly && !data.value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A read-only field must have a value greater than 0',
        path: ['value'],
      });

      return;
    }

    const [valueError] = validateNumberFieldValue(data.value ?? '', {
      type: 'number',
      ...data,
    });

    if (valueError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: valueError,
        path: ['value'],
      });
    }
  });

type TNumberFieldFormSchema = z.infer<typeof ZNumberFieldFormSchema>;

type EditorFieldNumberFormProps = {
  value: NumberFieldMeta | undefined;
  onValueChange: (value: NumberFieldMeta) => void;
};

export const EditorFieldNumberForm = ({
  value = {
    type: 'number',
  },
  onValueChange,
}: EditorFieldNumberFormProps) => {
  const { t } = useLingui();

  const form = useForm<TNumberFieldFormSchema>({
    resolver: zodResolver(ZNumberFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      placeholder: value.placeholder || '',
      value: value.value || '',
      numberFormat: value.numberFormat || null,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      lineHeight: value.lineHeight ?? FIELD_DEFAULT_LINE_HEIGHT,
      letterSpacing: value.letterSpacing ?? FIELD_DEFAULT_LETTER_SPACING,
      verticalAlign: value.verticalAlign ?? FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
      required: value.required || false,
      readOnly: value.readOnly || false,
      minValue: value.minValue,
      maxValue: value.maxValue,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZNumberFieldFormSchema.safeParse(formValues);

    const valueError = validatedFormValues.error?.issues.find((issue) => issue.path[0] === 'value')?.message;

    // Whether the value is valid depends on the other settings, and the form only re-validates
    // the setting which changed.
    if (valueError !== form.getFieldState('value').error?.message) {
      void form.trigger('value');
    }

    if (validatedFormValues.success) {
      onValueChange({
        type: 'number',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField className="w-full" formControl={form.control} />

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericTextAlignField className="w-full" formControl={form.control} />

            <EditorGenericVerticalAlignField className="w-full" formControl={form.control} />
          </div>

          <EditorGenericLabelField formControl={form.control} />

          <FormField
            control={form.control}
            name="placeholder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Placeholder</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    data-testid="field-form-placeholder"
                    className="bg-background"
                    placeholder={t`Placeholder`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Value</Trans>
                </FormLabel>
                <FormControl>
                  <Input data-testid="field-form-value" className="bg-background" placeholder={t`Value`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numberFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Number format</Trans>
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value === null ? '-1' : field.value}
                    onValueChange={(value) => field.onChange(value === '-1' ? null : value)}
                  >
                    <SelectTrigger
                      data-testid="field-form-numberFormat"
                      className="w-full bg-background text-muted-foreground"
                    >
                      <SelectValue placeholder={t`Field format`} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {numberFormatValues.map((item, index) => (
                        <SelectItem key={index} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}

                      <SelectItem value={'-1'}>
                        <Trans>None</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericLineHeightField className="w-full" formControl={form.control} />

            <EditorGenericLetterSpacingField className="w-full" formControl={form.control} />
          </div>

          <div className="mt-1">
            <EditorGenericRequiredField formControl={form.control} />
          </div>

          <EditorGenericReadOnlyField formControl={form.control} />

          {/* Validation section */}
          <section className="space-y-2">
            <div className="-mx-4 mt-2 mb-4">
              <Separator />
            </div>

            <p className="font-medium text-sm">
              <Trans>Validation</Trans>
            </p>

            <div className="flex flex-row gap-x-4">
              <FormField
                control={form.control}
                name="minValue"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>
                      <Trans>Min</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="field-form-minValue"
                        className="bg-background"
                        placeholder={t`E.g. 0`}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxValue"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>
                      <Trans>Max</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="field-form-maxValue"
                        className="bg-background"
                        placeholder={t`E.g. 100`}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>
        </fieldset>
      </form>
    </Form>
  );
};
