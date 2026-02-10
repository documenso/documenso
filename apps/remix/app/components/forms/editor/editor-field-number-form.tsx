import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Separator } from '@documenso/ui/primitives/separator';

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
  .refine(
    (data) => {
      // A read-only field must have a value greater than 0
      if (data.readOnly && data.value !== undefined && data.value !== '') {
        const numberValue = parseFloat(data.value);
        return !isNaN(numberValue) && numberValue > 0;
      }
      return !data.readOnly || (data.value !== undefined && data.value !== '');
    },
    {
      message: 'A read-only field must have a value greater than 0',
      path: ['value'],
    },
  );

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

    if (formValues.readOnly && !formValues.value) {
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
      <form>
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
                  <Input className="bg-background" placeholder={t`Placeholder`} {...field} />
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
                  <Input className="bg-background" placeholder={t`Value`} {...field} />
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
                    <SelectTrigger className="text-muted-foreground bg-background w-full">
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
            <div className="-mx-4 mb-4 mt-2">
              <Separator />
            </div>

            <p className="text-sm font-medium">
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
                        className="bg-background"
                        placeholder="E.g. 0"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : e.target.value)
                        }
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
                        className="bg-background"
                        placeholder="E.g. 100"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : e.target.value)
                        }
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
