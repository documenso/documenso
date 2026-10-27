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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg, plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const createSignFieldTextFormSchema = ({
  isInserted,
  characterLimit,
}: {
  isInserted: boolean;
  characterLimit?: number;
}) =>
  z.object({
    text: z.string().superRefine((text, ctx) => {
      // Inserted text can be cleared, which removes it from the field.
      if (!isInserted && text.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg`Text is required`.id,
        });

        return;
      }

      if (characterLimit !== undefined && text.length > characterLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: plural(text.length - characterLimit, {
            one: '# character over the limit',
            other: '# characters over the limit',
          }),
        });
      }
    }),
  });

type TSignFieldTextFormSchema = z.infer<ReturnType<typeof createSignFieldTextFormSchema>>;

export type SignFieldTextDialogProps = {
  fieldMeta?: TTextFieldMeta;
  /**
   * The text currently inserted into the field.
   *
   * When provided, the dialog is prefilled with this text and the user can remove it
   * by either clearing the text or clicking the remove button.
   */
  insertedText?: string;
};

export type SignFieldTextDialogResult = { action: 'save'; text: string } | { action: 'remove' };

export const SignFieldTextDialog = createCallable<SignFieldTextDialogProps, SignFieldTextDialogResult | null>(
  ({ call, fieldMeta, insertedText }) => {
    const { t } = useLingui();

    const isInserted = insertedText !== undefined;

    // A limit of 0 means the field has no limit.
    const characterLimit = fieldMeta?.characterLimit || undefined;

    const form = useForm<TSignFieldTextFormSchema>({
      resolver: zodResolver(createSignFieldTextFormSchema({ isInserted, characterLimit })),
      defaultValues: {
        text: insertedText ?? '',
      },
    });

    const onFormSubmit = ({ text }: TSignFieldTextFormSchema) => {
      if (isInserted && text.trim().length === 0) {
        call.end({ action: 'remove' });
        return;
      }

      call.end({ action: 'save', text });
    };

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
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field, fieldState }) => {
                    const isCounterVisible = characterLimit !== undefined && !fieldState.error;

                    return (
                      <FormItem>
                        {/* The dialog doesn't scroll, so the max height leaves 20rem for its title and buttons. */}
                        <FormControl>
                          <Textarea
                            id="custom-text"
                            placeholder={fieldMeta?.placeholder ?? t`Enter your text here`}
                            className={cn(
                              'h-auto max-h-[calc(100dvh-20rem)] min-h-20 w-full rounded-md [field-sizing:content]',
                              {
                                'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                                  fieldState.error,
                              },
                            )}
                            {...field}
                          />
                        </FormControl>

                        {(fieldState.error !== undefined || isCounterVisible || isInserted) && (
                          <div className="flex items-center gap-x-4 text-sm">
                            <FormMessage className="text-sm" />

                            {isCounterVisible &&
                              (field.value.length <= characterLimit ? (
                                <span className="text-muted-foreground">
                                  <Plural
                                    value={characterLimit - field.value.length}
                                    one="# character remaining"
                                    other="# characters remaining"
                                  />
                                </span>
                              ) : (
                                <span className="text-destructive">
                                  <Plural
                                    value={field.value.length - characterLimit}
                                    one="# character over the limit"
                                    other="# characters over the limit"
                                  />
                                </span>
                              ))}

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
                    );
                  }}
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
