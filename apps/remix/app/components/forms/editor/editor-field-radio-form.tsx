import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, Trash } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  DEFAULT_FIELD_FONT_SIZE,
  type TRadioFieldMeta as RadioFieldMeta,
  ZRadioFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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

const ZRadioFieldFormSchema = ZRadioFieldMeta.pick({
  label: true,
  direction: true,
  values: true,
  required: true,
  readOnly: true,
  fontSize: true,
}).refine(
  (data) => {
    // There cannot be more than one checked option
    if (data.values) {
      const checkedValues = data.values.filter((option) => option.checked);
      return checkedValues.length <= 1;
    }
    return true;
  },
  {
    message: 'There cannot be more than one checked option',
    path: ['values'],
  },
);

type TRadioFieldFormSchema = z.infer<typeof ZRadioFieldFormSchema>;

export type EditorFieldRadioFormProps = {
  value: RadioFieldMeta | undefined;
  onValueChange: (value: RadioFieldMeta) => void;
};

export const EditorFieldRadioForm = ({
  value = {
    type: 'radio',
    direction: 'vertical',
  },
  onValueChange,
}: EditorFieldRadioFormProps) => {
  const { t } = useLingui();

  const form = useForm<TRadioFieldFormSchema>({
    resolver: zodResolver(ZRadioFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      values: value.values || [{ id: 1, checked: false, value: 'Default value' }],
      required: value.required || false,
      readOnly: value.readOnly || false,
      direction: value.direction || 'vertical',
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
    },
  });

  const formValues = useWatch({
    control: form.control,
  });

  const addValue = () => {
    const currentValues = form.getValues('values') || [];
    const newId =
      currentValues.length > 0 ? Math.max(...currentValues.map((val) => val.id)) + 1 : 1;

    const newValues = [...currentValues, { id: newId, checked: false, value: '' }];
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
    const validatedFormValues = ZRadioFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'radio',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField formControl={form.control} />

          <FormField
            control={form.control}
            name="direction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Direction</Trans>
                </FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="text-muted-foreground bg-background w-full">
                      <SelectValue placeholder={t`Select direction`} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="vertical">
                        <Trans>Vertical</Trans>
                      </SelectItem>
                      <SelectItem value="horizontal">
                        <Trans>Horizontal</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <EditorGenericRequiredField formControl={form.control} />

          <EditorGenericReadOnlyField formControl={form.control} />

          <section className="space-y-2">
            <div className="-mx-4 mb-4 mt-2">
              <Separator />
            </div>

            <div className="flex flex-row items-center justify-between gap-2">
              <p className="text-sm font-medium">
                <Trans>Radio values</Trans>
              </p>

              <button type="button" onClick={addValue}>
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-2">
              {(formValues.values || []).map((value, index) => (
                <li key={`radio-value-${index}`} className="flex flex-row items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`values.${index}.checked`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Checkbox
                            className="data-[state=checked]:bg-primary border-foreground/30 h-5 w-5"
                            checked={field.value}
                            onCheckedChange={(value) => {
                              // Uncheck all other values.
                              const currentValues = form.getValues('values') || [];

                              if (value) {
                                const newValues = currentValues.map((val) => ({
                                  ...val,
                                  checked: false,
                                }));

                                form.setValue('values', newValues);
                              }

                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`values.${index}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input className="w-full" {...field} />
                        </FormControl>
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
