import { useEffect, useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { PlusIcon, Trash } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { validateCheckboxLength } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import {
  type TCheckboxFieldMeta as CheckboxFieldMeta,
  DEFAULT_FIELD_FONT_SIZE,
  ZCheckboxFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  checkboxValidationLength,
  checkboxValidationRules,
  checkboxValidationSigns,
} from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
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

const ZCheckboxFieldFormSchema = ZCheckboxFieldMeta.pick({
  label: true,
  direction: true,
  validationRule: true,
  validationLength: true,
  required: true,
  values: true,
  readOnly: true,
  fontSize: true,
})
  .extend({
    validationLength: z.coerce.number().optional(),
  })
  .refine(
    (data) => {
      // You need to specify both validation rule and length together
      if (data.validationRule && !data.validationLength) {
        return false;
      }
      if (data.validationLength && !data.validationRule) {
        return false;
      }
      return true;
    },
    {
      message: 'You need to specify both the validation rule and the number of options',
      path: ['validationRule'],
    },
  );

type TCheckboxFieldFormSchema = z.infer<typeof ZCheckboxFieldFormSchema>;

type EditorFieldCheckboxFormProps = {
  value: CheckboxFieldMeta | undefined;
  onValueChange: (value: CheckboxFieldMeta) => void;
};

export const EditorFieldCheckboxForm = ({
  value = {
    type: 'checkbox',
    direction: 'vertical',
  },
  onValueChange,
}: EditorFieldCheckboxFormProps) => {
  const form = useForm<TCheckboxFieldFormSchema>({
    resolver: zodResolver(ZCheckboxFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      direction: value.direction || 'vertical',
      validationRule: value.validationRule || '',
      validationLength: value.validationLength || 0,
      values: value.values || [{ id: 1, checked: false, value: '' }],
      required: value.required || false,
      readOnly: value.readOnly || false,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  const addValue = (numberOfValues: number = 1) => {
    const currentValues = form.getValues('values') || [];
    const currentMaxId = Math.max(...currentValues.map((val) => val.id));

    const newValues = Array.from({ length: numberOfValues }, (_, index) => ({
      id: currentMaxId + index + 1,
      checked: false,
      value: '',
    }));

    form.setValue('values', [...currentValues, ...newValues]);
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
    const validatedFormValues = ZCheckboxFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        ...value,
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  const isValidationRuleMetForPreselectedValues = useMemo(() => {
    const preselectedValues = (formValues.values || [])?.filter((value) => value.checked);

    if (formValues.validationLength && formValues.validationRule && preselectedValues.length > 0) {
      const validationRule = checkboxValidationSigns.find(
        (sign) => sign.label === formValues.validationRule,
      );

      if (!validationRule) {
        return false;
      }

      return validateCheckboxLength(
        preselectedValues.length,
        validationRule.value,
        formValues.validationLength,
      );
    }

    return true;
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

          <div className="flex flex-row items-center justify-start gap-x-4">
            <div className="flex w-2/3 flex-col">
              <FormField
                control={form.control}
                name="validationRule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Validation</Trans>
                    </FormLabel>
                    <FormControl>
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger className="text-muted-foreground bg-background w-full">
                          <SelectValue placeholder={t`Select at least`} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {checkboxValidationRules.map((item, index) => (
                            <SelectItem key={index} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-3 flex w-1/3 flex-col">
              <FormField
                control={form.control}
                name="validationLength"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => {
                          const validationNumber = Number(value);

                          const currentValues = formValues.values || [];

                          const minimumNumberOfValuesRequired =
                            validationNumber - currentValues.length;

                          if (!formValues.validationRule) {
                            form.setValue('validationRule', checkboxValidationRules[0]);
                          }

                          if (minimumNumberOfValuesRequired > 0) {
                            addValue(minimumNumberOfValuesRequired);
                          }

                          field.onChange(validationNumber);
                          void form.trigger();
                        }}
                      >
                        <SelectTrigger className="text-muted-foreground bg-background mt-5 w-full">
                          <SelectValue placeholder={t`Pick a number`} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {checkboxValidationLength.map((item, index) => (
                            <SelectItem key={index} value={String(item)}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

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
                <Trans>Checkbox values</Trans>
              </p>

              <button type="button" onClick={() => addValue()}>
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-2">
              {(formValues.values || []).map((value, index) => (
                <li key={`checkbox-value-${index}`} className="flex flex-row items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`values.${index}.checked`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Checkbox
                            className="data-[state=checked]:bg-primary border-foreground/30 h-5 w-5"
                            checked={field.value}
                            onCheckedChange={field.onChange}
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

            {!isValidationRuleMetForPreselectedValues && (
              <Alert variant="warning">
                <AlertDescription>
                  <Trans>
                    The preselected values will be ignored unless they meet the validation criteria.
                  </Trans>
                </AlertDescription>
              </Alert>
            )}
          </section>
        </fieldset>
      </form>
    </Form>
  );
};
