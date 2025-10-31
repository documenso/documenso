import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { PlusIcon, Trash } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  DEFAULT_FIELD_FONT_SIZE,
  type TDropdownFieldMeta as DropdownFieldMeta,
} from '@documenso/lib/types/field-meta';
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
  EditorGenericReadOnlyField,
  EditorGenericRequiredField,
} from './editor-field-generic-field-forms';

const ZDropdownFieldFormSchema = z.object({
  defaultValue: z.string().optional(),
  values: z
    .object({
      value: z.string().min(1, {
        message: msg`Option value cannot be empty`.id,
      }),
    })
    .array()
    .min(1, {
      message: msg`Dropdown must have at least one option`.id,
    })
    .superRefine((values, ctx) => {
      const seen = new Map<string, number[]>(); // value → indices

      values.forEach((item, index) => {
        const key = item.value;
        if (!seen.has(key)) {
          seen.set(key, []);
        }
        seen.get(key)!.push(index);
      });

      for (const [key, indices] of seen) {
        if (indices.length > 1 && key.trim() !== '') {
          for (const i of indices) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: msg`Duplicate values are not allowed`.id,
              path: [i, 'value'],
            });
          }
        }
      }
    }),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  fontSize: z.number().optional(),
});

type TDropdownFieldFormSchema = z.infer<typeof ZDropdownFieldFormSchema>;

type EditorFieldDropdownFormProps = {
  value: DropdownFieldMeta | undefined;
  onValueChange: (value: DropdownFieldMeta) => void;
};

export const EditorFieldDropdownForm = ({
  value = {
    type: 'dropdown',
  },
  onValueChange,
}: EditorFieldDropdownFormProps) => {
  const { t } = useLingui();

  const form = useForm<TDropdownFieldFormSchema>({
    resolver: zodResolver(ZDropdownFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      defaultValue: value.defaultValue,
      values: value.values || [{ value: 'Option 1' }],
      required: value.required || false,
      readOnly: value.readOnly || false,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
    },
  });

  const formValues = useWatch({
    control: form.control,
  });

  const addValue = () => {
    const currentValues = form.getValues('values') || [];

    let newValue = 'New option';

    // Iterate to create a unique value
    for (let i = 0; i < currentValues.length; i++) {
      newValue = `New option ${i + 1}`;
      if (currentValues.some((item) => item.value === `New option ${i + 1}`)) {
        newValue = `New option ${i + 1}`;
      } else {
        break;
      }
    }

    const newValues = [...currentValues, { value: newValue }];

    form.setValue('values', newValues);
  };

  const removeValue = (index: number) => {
    const currentValues = form.getValues('values') || [];

    if (currentValues.length === 1) {
      return;
    }

    const newValues = [...currentValues];
    newValues.splice(index, 1);

    form.setValue('values', newValues);

    if (form.getValues('defaultValue') === newValues[index].value) {
      form.setValue('defaultValue', undefined);
    }
  };

  useEffect(() => {
    const validatedFormValues = ZDropdownFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'dropdown',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField formControl={form.control} />

          {/* Todo: Envelopes This is buggy. */}
          <FormField
            control={form.control}
            name="defaultValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Select default option</Trans>
                </FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    value={field.value ?? '-1'}
                    onValueChange={(value) => field.onChange(value === '-1' ? undefined : value)}
                  >
                    <SelectTrigger className="text-muted-foreground bg-background w-full">
                      <SelectValue placeholder={t`Default Value`} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {(formValues.values || [])
                        .filter((item) => item.value)
                        .map((item, index) => (
                          <SelectItem key={index} value={item.value || ''}>
                            {item.value}
                          </SelectItem>
                        ))}

                      <SelectItem value={'-1'}>
                        <Trans>Default Value</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="mt-1">
            <EditorGenericRequiredField formControl={form.control} />
          </div>

          <EditorGenericReadOnlyField formControl={form.control} />

          <section className="space-y-2">
            <div className="-mx-4 mb-4 mt-2">
              <Separator />
            </div>

            <div className="flex flex-row items-center justify-between gap-2">
              <p className="text-sm font-medium">
                <Trans>Dropdown values</Trans>
              </p>

              <button type="button" onClick={addValue}>
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-2">
              {(formValues.values || []).map((value, index) => (
                <li key={`dropdown-value-${index}`} className="flex flex-row gap-2">
                  <FormField
                    control={form.control}
                    name={`values.${index}.value`}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => removeValue(index)}
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </fieldset>
      </form>
    </Form>
  );
};
