import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Plural, Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm, useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { validateCheckboxLength } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { type TCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Form, FormControl, FormField, FormItem } from '@documenso/ui/primitives/form/form';

export type SignFieldCheckboxDialogProps = {
  fieldMeta: TCheckboxFieldMeta;
  validationRule: '>=' | '=' | '<=';
  validationLength: number;
  preselectedIndices: number[];
};

export const SignFieldCheckboxDialog = createCallable<
  SignFieldCheckboxDialogProps,
  number[] | null
>(({ call, fieldMeta, validationRule, validationLength, preselectedIndices }) => {
  const ZSignFieldCheckboxFormSchema = z
    .object({
      values: z.array(
        z.object({
          checked: z.boolean(),
          value: z.string(),
        }),
      ),
    })
    .superRefine((data, ctx) => {
      // Allow unselecting all options if the field is not required even if
      // validation is not met.
      if (!fieldMeta.required && data.values.every((value) => !value.checked)) {
        return;
      }

      const numberOfSelectedValues = data.values.filter((value) => value.checked).length;

      const isValid = validateCheckboxLength(
        numberOfSelectedValues,
        validationRule,
        validationLength,
      );

      if (!isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg`Validation failed`.id,
        });
      }
    });

  const form = useForm<z.infer<typeof ZSignFieldCheckboxFormSchema>>({
    resolver: zodResolver(ZSignFieldCheckboxFormSchema),
    defaultValues: {
      values: (fieldMeta.values || []).map((value, index) => ({
        checked: preselectedIndices.includes(index) || false,
        value: value.value,
      })),
    },
  });

  const formValues = useWatch({
    control: form.control,
  });

  return (
    <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Sign Checkbox Field</Trans>
          </DialogTitle>

          <DialogDescription
            className={cn('mt-4', {
              'text-destructive': Object.keys(form.formState.errors).length > 0,
            })}
          >
            {match(validationRule)
              .with('>=', () => (
                <Plural
                  value={validationLength}
                  one="Select at least # option"
                  other="Select at least # options"
                />
              ))
              .with('=', () => (
                <Plural
                  value={validationLength}
                  one="Select exactly # option"
                  other="Select exactly # options"
                />
              ))
              .with('<=', () => (
                <Plural
                  value={validationLength}
                  one="Select at most # option"
                  other="Select at most # options"
                />
              ))
              .exhaustive()}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              call.end(
                data.values
                  .map((value, i) => (value.checked ? i : null))
                  .filter((value) => value !== null),
              ),
            )}
          >
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <ul className="space-y-3">
                {(formValues.values || []).map((value, index) => (
                  <li key={`checkbox-${index}`}>
                    <FormField
                      control={form.control}
                      name={`values.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex items-center">
                              <Checkbox
                                id={`checkbox-value-${index}`}
                                className="data-[state=checked]:bg-primary border-foreground/30 h-5 w-5"
                                checked={field.value.checked}
                                onCheckedChange={(checked) => {
                                  field.onChange({
                                    ...field.value,
                                    checked,
                                  });
                                }}
                              />

                              <label
                                className="text-muted-foreground ml-2 w-full text-sm"
                                htmlFor={`checkbox-value-${index}`}
                              >
                                {value.value}
                              </label>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </li>
                ))}
              </ul>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit">
                  <Trans>Sign</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
