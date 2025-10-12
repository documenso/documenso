import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TDropdownFieldMeta } from '@documenso/lib/types/field-meta';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

const ZSignFieldDropdownFormSchema = z.object({
  dropdown: z.string().min(1, { message: msg`Option is required`.id }),
});

type TSignFieldDropdownFormSchema = z.infer<typeof ZSignFieldDropdownFormSchema>;

export type SignFieldDropdownDialogProps = {
  fieldMeta: TDropdownFieldMeta;
};

export const SignFieldDropdownDialog = createCallable<SignFieldDropdownDialogProps, string | null>(
  ({ call, fieldMeta }) => {
    const { t } = useLingui();

    const values = fieldMeta.values?.map((value) => value.value) ?? [];

    const form = useForm<TSignFieldDropdownFormSchema>({
      resolver: zodResolver(ZSignFieldDropdownFormSchema),
      defaultValues: {
        dropdown: fieldMeta.defaultValue,
      },
    });

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Sign Dropdown Field</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Select a value to sign into the field</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => call.end(data.dropdown))}>
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="dropdown"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select {...field} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={t`Select an option`} />
                          </SelectTrigger>

                          <SelectContent>
                            {values.map((value, i) => (
                              <SelectItem key={i} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
