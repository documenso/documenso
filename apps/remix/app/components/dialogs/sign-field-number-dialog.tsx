import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import type { TNumberFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export type SignFieldNumberDialogProps = {
  fieldMeta: TNumberFieldMeta;
};

export const SignFieldNumberDialog = createCallable<SignFieldNumberDialogProps, string | null>(
  ({ call, fieldMeta }) => {
    const { t } = useLingui();

    // Needs to be inside dialog for translation purposes. Matches on the validator's English
    // error text to pick a translated message, so keep the two in sync.
    const createNumberFieldSchema = (fieldMeta: TNumberFieldMeta) => {
      const { numberFormat, minValue, maxValue } = fieldMeta;

      return z.string().superRefine((value, ctx) => {
        const errors = validateNumberField(value, fieldMeta, true);

        if (errors.length === 0) {
          return;
        }

        const hasError = (text: string) => errors.some((error) => error.includes(text));

        if (hasError('does not match the number format')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t`Number needs to be formatted as ${numberFormat}`,
          });

          return;
        }

        if (hasError('could be read as')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t`This number could be read in more than one way. Please write it without a thousands separator.`,
          });

          return;
        }

        if (typeof minValue === 'number' && hasError('is less than the minimum value')) {
          ctx.addIssue({
            code: z.ZodIssueCode.too_small,
            minimum: minValue,
            inclusive: true,
            type: 'number',
          });

          return;
        }

        if (typeof maxValue === 'number' && hasError('is greater than the maximum value')) {
          ctx.addIssue({
            code: z.ZodIssueCode.too_big,
            maximum: maxValue,
            inclusive: true,
            type: 'number',
          });

          return;
        }

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t`Please enter a valid number`,
        });
      });
    };

    const ZSignFieldNumberFormSchema = z.object({
      number: createNumberFieldSchema(fieldMeta),
    });

    const form = useForm<z.infer<typeof ZSignFieldNumberFormSchema>>({
      resolver: zodResolver(ZSignFieldNumberFormSchema),
      defaultValues: {
        number: undefined,
      },
    });

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fieldMeta?.label || <Trans>Enter Number</Trans>}</DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Please enter a number</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => call.end(data.number.trim()))}>
              <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder={fieldMeta.placeholder ?? t`Enter your number here`}
                          className={cn('w-full rounded-md', {
                            'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                              fieldState.error,
                          })}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit">
                    <Trans>Enter</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  },
);
