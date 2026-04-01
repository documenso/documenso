import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Plural, useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TTextFieldMeta } from '@documenso/lib/types/field-meta';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';

const ZSignFieldTextFormSchema = z.object({
  text: z.string().min(1, { message: msg`Text is required`.id }),
});

type TSignFieldTextFormSchema = z.infer<typeof ZSignFieldTextFormSchema>;

export type SignFieldTextDialogProps = {
  fieldMeta?: TTextFieldMeta;
};

export const SignFieldTextDialog = createCallable<SignFieldTextDialogProps, string | null>(
  ({ call, fieldMeta }) => {
    const { t } = useLingui();

    const form = useForm<TSignFieldTextFormSchema>({
      resolver: zodResolver(ZSignFieldTextFormSchema),
      defaultValues: {
        text: '',
      },
    });

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fieldMeta?.label || <Trans>Enter Text</Trans>}</DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Please enter a value</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => call.end(data.text))}>
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          id="custom-text"
                          placeholder={fieldMeta?.placeholder ?? t`Enter your text here`}
                          className={cn('w-full rounded-md', {
                            'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                              fieldState.error,
                          })}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      {fieldMeta?.characterLimit !== undefined &&
                        fieldMeta?.characterLimit > 0 &&
                        !fieldState.error && (
                          <div className="text-sm text-muted-foreground">
                            <Plural
                              value={fieldMeta?.characterLimit - (field.value?.length ?? 0)}
                              one="# character remaining"
                              other="# characters remaining"
                            />
                          </div>
                        )}
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
