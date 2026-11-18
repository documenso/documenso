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
import { numberFormatValues } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export type SignFieldNumberDialogProps = {
  fieldMeta: TNumberFieldMeta;
  /**
   * The number currently inserted into the field.
   *
   * When provided, the dialog is prefilled with this number and the user can remove it
   * by either clearing the number or clicking the remove button.
   */
  insertedNumber?: string;
};

export type SignFieldNumberDialogResult = { action: 'save'; number: string } | { action: 'remove' };

export const SignFieldNumberDialog = createCallable<SignFieldNumberDialogProps, SignFieldNumberDialogResult | null>(
  ({ call, fieldMeta, insertedNumber }) => {
    const { t } = useLingui();

    const isInserted = insertedNumber !== undefined;

    // Needs to be inside dialog for translation purposes.
    const createNumberFieldSchema = (fieldMeta: TNumberFieldMeta) => {
      const { numberFormat, minValue, maxValue } = fieldMeta;

      if (numberFormat) {
        const foundRegex = numberFormatValues.find((item) => item.value === numberFormat)?.regex;

        if (foundRegex) {
          return z.string().refine(
            (value) => {
              return foundRegex.test(value.toString());
            },
            {
              message: t`Number needs to be formatted as ${numberFormat}`,
            },
          );
        }
      }

      // Not gong to work with min/max numbers + number format
      // Since currently doesn't work in V1 going to ignore for now.
      return z.string().superRefine((value, ctx) => {
        const isValidNumber = /^[0-9,.]+$/.test(value.toString());

        if (!isValidNumber) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t`Please enter a valid number`,
          });

          return;
        }

        if (typeof minValue === 'number' && parseFloat(value) < minValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.too_small,
            minimum: minValue,
            inclusive: true,
            type: 'number',
          });

          return;
        }

        if (typeof maxValue === 'number' && parseFloat(value) > maxValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.too_big,
            maximum: maxValue,
            inclusive: true,
            type: 'number',
          });

          return;
        }
      });
    };

    const numberSchema = createNumberFieldSchema(fieldMeta);

    const ZSignFieldNumberFormSchema = z.object({
      // An inserted number can be cleared, which removes it from the field.
      number: isInserted ? numberSchema.or(z.literal('')) : numberSchema,
    });

    const form = useForm<z.infer<typeof ZSignFieldNumberFormSchema>>({
      resolver: zodResolver(ZSignFieldNumberFormSchema),
      defaultValues: {
        number: insertedNumber,
      },
    });

    const onFormSubmit = ({ number }: z.infer<typeof ZSignFieldNumberFormSchema>) => {
      if (number === '') {
        call.end({ action: 'remove' });
        return;
      }

      call.end({ action: 'save', number });
    };

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fieldMeta.label || <Trans>Enter Number</Trans>}</DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Please enter a number</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
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

                      {(fieldState.error !== undefined || isInserted) && (
                        <div className="flex items-center gap-x-4 text-sm">
                          <FormMessage className="text-sm" />

                          {isInserted && (
                            <Button
                              type="button"
                              variant="link"
                              className="ml-auto h-auto p-0 text-destructive"
                              onClick={() => call.end({ action: 'remove' })}
                            >
                              <Trans>Remove</Trans>
                            </Button>
                          )}
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit">{isInserted ? <Trans>Save</Trans> : <Trans>Enter</Trans>}</Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  },
);
