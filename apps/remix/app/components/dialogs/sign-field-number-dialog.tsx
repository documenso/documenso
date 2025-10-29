import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';

const createNumberFieldSchema = (fieldMeta: TNumberFieldMeta) => {
  let schema = z.coerce.number({
    invalid_type_error: msg`Please enter a valid number`.id,
  });

  const { numberFormat, minValue, maxValue } = fieldMeta;

  if (typeof minValue === 'number') {
    schema = schema.min(minValue);
  }

  if (typeof maxValue === 'number') {
    schema = schema.max(maxValue);
  }

  if (numberFormat) {
    const foundRegex = numberFormatValues.find((item) => item.value === numberFormat)?.regex;

    if (!foundRegex) {
      return schema;
    }

    return schema.refine(
      (value) => {
        return foundRegex.test(value.toString());
      },
      {
        message: msg`Number needs to be formatted as ${numberFormat}`.id,
      },
    );
  }

  return schema;
};

export type SignFieldNumberDialogProps = {
  fieldMeta: TNumberFieldMeta;
};

export const SignFieldNumberDialog = createCallable<SignFieldNumberDialogProps, number | null>(
  ({ call, fieldMeta }) => {
    const { t } = useLingui();

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
            <DialogTitle>
              <Trans>Sign Number Field</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Insert a value into the number field</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => call.end(data.number))}>
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      {fieldMeta.label && <FormLabel>{fieldMeta.label}</FormLabel>}

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
                    <Trans>Sign</Trans>
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
