import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { PlusIcon, Trash } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { type TDropdownFieldMeta as DropdownFieldMeta } from '@documenso/lib/types/field-meta';
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
  EditorGenericReadOnlyField,
  EditorGenericRequiredField,
} from './editor-field-generic-field-forms';

const ZDropdownFieldFormSchema = z
  .object({
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
      .refine(
        (data) => {
          // Todo: Envelopes - This doesn't work.
          console.log({
            data,
          });

          if (data) {
            const values = data.map((item) => item.value);
            return new Set(values).size === values.length;
          }
          return true;
        },
        {
          message: 'Duplicate values are not allowed',
        },
      ),
    required: z.boolean().optional(),
    readOnly: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Default value must be one of the available options
      if (data.defaultValue && data.values) {
        return data.values.some((item) => item.value === data.defaultValue);
      }
      return true;
    },
    {
      message: 'Default value must be one of the available options',
      path: ['defaultValue'],
    },
  );

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
    },
  });

  const formValues = useWatch({
    control: form.control,
  });

  const addValue = () => {
    const currentValues = form.getValues('values') || [];
    const newValues = [...currentValues, { value: 'New option' }];

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

  const { formState } = form;

  useEffect(() => {
    console.log({
      errors: formState.errors,
      formValues,
    });
  }, [formState, formState.errors, formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
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
                    // Todo: Envelopes - This is buggy, removing/adding should update the default value.
                    {...field}
                    value={field.value}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="text-muted-foreground bg-background w-full">
                      <SelectValue placeholder={t`Default Value`} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {(formValues.values || []).map((item, index) => (
                        <SelectItem key={index} value={item.value || ''}>
                          {item.value}
                        </SelectItem>
                      ))}
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
